/**
 * Copyright 2014 GetHuman LLC
 * Author: Jeff Whelpley
 * Date: 10/21/14
 *
 *
 */
var _               = require('lodash');
var pancakes        = require('pancakes');
var apiRouteHandler = pancakes.apiRouteHandler;

/**
 * Go through all resources and add the API endpoints to the Hapi
 * server that is passed in
 * @param opts
 */
function addApiRoutes(opts) {
    var resources   = pancakes.cook('resources', null);
    var apiPrefix   = opts.apiPrefix;
    var server      = opts.server;
    var auth        = opts.auth;

    _.each(resources, function (resource) {
        _.each(resource.api, function (methodInfo, httpMethod) {
            _.each(methodInfo, function (operation, path) {
                server.route({
                    method:     httpMethod,
                    path:       apiPrefix + path,
                    handler:    getApiRouteHandler(resource, operation, auth)
                });
            });
        });
    });
}

/**
 * Get a route handler given a set of parameters
 * @param resource
 * @param operation
 * @param auth Optional auth function
 * @returns {Function}
 */
function getApiRouteHandler(resource, operation, auth) {
    return function (request, reply) {
        var req = {
            caller:     request.caller,
            resource:   resource,
            method:     operation,
            auth:       auth ? auth(request) : undefined
        };

        // add query and params to the request
        _.extend(req, request.query, request.params);

        if (request.payload && !_.isEmpty(request.payload)) {
            req.data = request.payload;
        }

        return apiRouteHandler.processApiCall(resource, operation, req)
            .then(function (res) {
                reply(res.data);
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