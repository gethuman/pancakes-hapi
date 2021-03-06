/**
 * Copyright 2014 GetHuman LLC
 * Author: Jeff Whelpley
 * Date: 10/21/14
 *
 *
 */
var _ = require('lodash');
var Q = require('q');

/**
 * Go through all resources and add the API endpoints to the Hapi
 * server that is passed in
 * @param opts
 */
function addApiRoutes(opts) {
    var resources   = this.pancakes.cook('resources', null);
    var apiPrefix   = opts.apiPrefix;
    var server      = opts.server;
    var me          = this;
    var cors = {
        origin:         opts.hosts || [],
        headers:        ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version', 'X-Requested-With', 'Authorization'],
        credentials:    true
    };

    _.each(resources, function (resource) {
        _.each(resource.api, function (methodInfo, httpMethod) {
            _.each(methodInfo, function (operation, path) {

                // if path includes {_id} convert to {_id?} so optional
                // this will allow both /users/someid and /users to work
                // we want this because pancakes handles param validation
                // only do this if path without {_id} is not already defined
                var lenWithoutId = path.length - 6;
                var pathWithoutId = path.substring(0, lenWithoutId);
                if (path.substring(lenWithoutId) === '/{_id}' && !methodInfo[pathWithoutId]) {
                    path = pathWithoutId + '/{_id?}';
                }

                // if the operation is a string, then it is the name of the handler method
                if (_.isString(operation)) {
                    server.route({
                        method:             httpMethod,
                        path:               apiPrefix + path,
                        config: {
                            cors:           cors,
                            handler:        me.getApiRouteHandler(resource, operation)
                        }
                    });
                }

                // else if object with type stream, need to use a slightly different call to server.route
                else if (_.isObject(operation) && operation.type === 'stream' && operation.operation) {
                    server.route({
                        method:             httpMethod,
                        path:               apiPrefix + path,
                        config: {
                            payload: {
                                maxBytes:   209715200,
                                output:     'stream',
                                parse:      true
                            },
                            cors:           cors,
                            handler:        me.getApiRouteHandler(resource, operation.operation)
                        }
                    });
                }
                // or xml...
                else if (_.isObject(operation) && operation.type === 'xml' && operation.operation) {
                    server.route({
                        method:             httpMethod,
                        path:               apiPrefix + path,
                        config: {
                            cors:           cors,
                            handler:        me.getApiRouteHandler(resource, operation.operation, 'application/xml; charset=utf-8')
                        }
                    });
                }

                // else error
                else {
                    throw new Error('Invalid type of operation for ' + resource.name + ' ' + path);
                }
            });
        });
    });

    server.on('response', function (request) {
        // careful because we don't want to screw up all/any requests...
        if ( request.response && request.response.statusCode && request.response.statusCode > 399 && request.method
                && request.method.toUpperCase && request.url && request.url.path ) {
            var lapse = -1;
            if ( request.info && request.info.responded && request.info.received ) {
                lapse = request.info.responded - request.info.received;
            }
            var msg = request.method.toUpperCase() + ' ' + request.url.path + ' -> '
                + request.response.statusCode + ' ' + '(' + lapse + 'ms)';
            if ( request.info && request.info.referrer && request.info.referrer.length ) {
                msg += ' ref: ' + request.info.referrer;
            }

            /* eslint no-console:0 */
            console.log(msg);
        }
    });
}

/**
 * Get a route handler given a set of parameters
 * @param resource
 * @param operation
 * @param contentType if nec
 * @returns {Function}
 */
function getApiRouteHandler(resource, operation, contentType) {
    var me = this;

    return function (request, reply) {
        var req = {
            caller:     request.caller,
            resource:   resource,
            method:     operation
        };

        // add query and params to the request
        _.extend(req, request.query, request.params);

        if (request.payload && !_.isEmpty(request.payload)) {
            req.data = request.payload;
        }

        return Q.fcall(function () {
            return me.pancakes.apiRouteHandler.processApiCall(resource, operation, req);
        })
            .then(function (res) {
                if ( contentType ) {
                    reply(res.data).type(contentType);
                }
                else {
                    reply(res.data);
                }
            })
            .catch(function (err) {
                reply(err);
            });
    };
}

module.exports = {
    addApiRoutes: addApiRoutes,
    getApiRouteHandler: getApiRouteHandler
};