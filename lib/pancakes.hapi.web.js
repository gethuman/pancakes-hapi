/**
 * Copyright 2014 GetHuman LLC
 * Author: Jeff Whelpley
 * Date: 10/21/14
 *
 *
 */
var _ = require('lodash');
var Q = require('q');
var routeHandler;

/* eslint no-console:0 */

/**
 * Add web routes
 * @param opts
 */
function addWebRoutes(opts) {
    var server = opts.server;
    var socialProviders = opts.config && opts.config.security && opts.config.security.social;
    var me = this;

    // first add social auth routes
    _.each(socialProviders, function (provider, providerName) {
        server.route({
            method:     ['GET', 'POST'],
            path:       '/auth/' + providerName,
            handler:    me.getWebRouteHandler(opts),
            config:     { auth: providerName }
        });
    });

    routeHandler = this.getWebRouteHandler(opts);

    // all other URLs checked against app config files for dymanic web routes
    server.route({
        method:     '*',
        path:       '/{p*}',
        handler:    routeHandler,
        config: {
            state: {
                parse:      true,
                failAction: 'log'
            }
        }
    });

    // for now simple access logging for errors
    server.on('response', function (request) {
        if ( request.response && request.response.statusCode && request.response.statusCode > 399 && request.method
                && request.method.toUpperCase && request.info && request.info.hostname && request.url && request.url.path ) {
            var lapse = -1;
            if ( request.info && request.info.responded && request.info.received ) {
                lapse = request.info.responded - request.info.received;
            }
            var msg = request.method.toUpperCase() + ' ' + request.info.hostname + request.url.path + ' -> '
                + request.response.statusCode + ' ' + '(' + lapse + 'ms)';
            if ( request.info.referrer && request.info.referrer.length ) {
                msg += ' ref: ' + request.info.referrer;
            }
            console.log(msg);
        }
    });
}

/**
 * The idea here is to use the same request and reply
 * but a different route handler based on the given URL override
 */
function processRoute(opts) {
    if (routeHandler) {
        routeHandler(opts.request, opts.reply, opts.urlOverride, opts.returnCode);
    }
    else {
        opts.reply.continue();
    }
}

/**
 * Execute the server preprocessing method and return true if the preprocessor
 * handled the request
 *
 * @param request
 * @param reply
 * @returns {Function}
 */
function getServerPreProcessing(request, reply) {
    var me = this;

    return function (routeInfo, page, model) {
        if (!page.serverPreprocessing) { return false; }

        var deps = { request: request, reply: reply, model: model, routeInfo: routeInfo };
        return me.pancakes.cook(page.serverPreprocessing, { dependencies: deps });
    };
}

/**
 * Render the web route for one of the dynamic routes. These routes are based off of
 * the .app config files for each app.
 *
 * @param opts
 */
function getWebRouteHandler(opts) {
    var webRouteHandler = this.pancakes.webRouteHandler;
    var me = this;

    return function handleWebRoute(request, reply, urlOverride, returnCode) {
        var appName = request.app.name;
        var url = urlOverride || request.url.pathname;
        var routeInfo = null;
        var routeHelper = me.pancakes.cook('routeHelper');
        var newrelic = require('newrelic');

        Q.fcall(function () {
            routeInfo = webRouteHandler.getRouteInfo(appName, url, request.query, request.app.lang);
            newrelic.setTransactionName(routeInfo.appName + '||' + routeInfo.lang + '||' + routeInfo.urlPattern);

            // if redirect URL exists, just redirect right away
            if (routeInfo.redirect) {

                // make sure tokens in the redirect URL are replaced
                var redirectUrl = routeInfo.redirect;
                _.each(routeInfo.tokens, function (value, key) {
                    redirectUrl = redirectUrl.replace('{' + key + '}', value);
                });

                if (redirectUrl.indexOf('{') >= 0) {
                    //throw new Error('Redirect URL has token that was not replaced: ' + redirectUrl);
                    // we can't just throw errors in here
                    console.log('Bad redirect: ' + redirectUrl);
                    reply(new Error('So sorry, but there is an error here right now, and we are trying to fix it. Please try again later.'));
                    return;
                }

                // do full url for all redirects
                if (redirectUrl.indexOf('http') !== 0) {
                    redirectUrl = (routeHelper.getBaseUrl(routeInfo.appName) + '') + redirectUrl;
                }

                reply().redirect(redirectUrl).permanent(true);
                return;
            }

            // if the app is handling this request, don't do anything
            if (opts.preProcess && opts.preProcess(request, reply)) {
                return;
            }

            var callbacks = {
                serverPreprocessing:    me.getServerPreProcessing(request, reply),
                addToModel:             opts.addToModel,
                pageCacheService:       opts.pageCacheService
            };

            return webRouteHandler.processWebRequest(routeInfo, callbacks)
                .then(function (renderedPage) {

                    // if no rendered page, it means request was handled earlier somewhere (ex. serverPreprocess redirect)
                    if (!renderedPage) {
                        //console.log('No rendered page for ' + url);
                        return;
                    }

                    var response = reply(renderedPage).code(returnCode || 200);

                    // add content type if in the route info
                    if (routeInfo.contentType) {
                        response.header('Content-Type', routeInfo.contentType);
                    }

                    // as long as the nocache attribute is NOT set, add cache headers (sorry for double negative :-))
                    if (!routeInfo.nocache) {
                        response.header('cache-control', 'public, max-age=60');
                    }
                    return true;
                });
        })
            .catch(function (err) {
                console.error(err);
                reply(err);
            });
    };
}

module.exports = {
    processRoute: processRoute,
    addWebRoutes: addWebRoutes,
    getWebRouteHandler: getWebRouteHandler,
    getServerPreProcessing: getServerPreProcessing
};