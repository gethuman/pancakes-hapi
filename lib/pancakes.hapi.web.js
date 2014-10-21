/**
 * Copyright 2014 GetHuman LLC
 * Author: Jeff Whelpley
 * Date: 10/21/14
 *
 *
 */
var _               = require('lodash');
var pancakes        = require('pancakes');
var webRouteHandler = pancakes.webRouteHandler;

/**
 * Add web routes
 * @param opts
 */
function addWebRoutes(opts) {
    var server = opts.server;

    //TODO: make these social auth routes more dynamic; currently listed out because of 'auth' route param
    server.route({
        method:     ['GET', 'POST'],
        path:       '/auth/facebook',
        handler:    getWebRouteHandler(opts),
        config: {
            auth:   'facebook'
        }
    });
    server.route({
        method:     ['GET', 'POST'],
        path:       '/auth/google',
        handler:    getWebRouteHandler(opts),
        config: {
            auth:   'google'
        }
    });

    // all other URLs checked against app config files for dymanic web routes
    server.route({
        method:     '*',
        path:       '/{p*}',
        handler:    getWebRouteHandler(opts)
    });
}

/**
 * Render the web route for one of the dynamic routes. These routes are based off of
 * the .app config files for each app.
 *
 * @param opts
 */
function getWebRouteHandler(opts) {
    return function handleWebRoute(request, reply) {
        var appName = request.app.name;
        var routeInfo = webRouteHandler.getRouteInfo(appName, request.url.pathname, request.query, request.lang);

        // if redirect URL exists, just redirect right away
        if (routeInfo.redirectUrl) {
            reply().redirect(routeInfo.redirectUrl); return;
        }

        // if the app is handling this request, don't do anything
        if (opts.preProcess && opts.preProcess(request, reply)) { return; }

        var callbacks = {
            serverPreProcessing:    getServerPreProcessing(request, reply),
            addToModel:             opts.addToModel
        };

        // if we get here, the request is valid so process it and then return the rendered page
        webRouteHandler.processWebRequest(routeInfo, callbacks)
            .then(function (renderedPage) {
                routeInfo.contentType ?
                    reply(renderedPage).header('Content-Type', routeInfo.contentType) :
                    reply(renderedPage);
            })
            .done();    // throw error up to app level error handler
    };
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
    return function (routeInfo, page, model) {
        if (!page.serverPreProcessing) { return false; }

        var deps = { request: request, reply: reply, model: model, routeInfo: routeInfo };
        return pancakes.cook(page.serverPreProcessing, { dependencies: deps });
    };
}

module.exports = {
    addWebRoutes: addWebRoutes,
    getWebRouteHandler: getWebRouteHandler,
    getServerPreProcessing: getServerPreProcessing
};