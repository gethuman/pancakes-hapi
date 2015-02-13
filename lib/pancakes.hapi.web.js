/**
 * Copyright 2014 GetHuman LLC
 * Author: Jeff Whelpley
 * Date: 10/21/14
 *
 *
 */
//var newrelic = require('newrelic');

/**
 * Add web routes
 * @param opts
 */
function addWebRoutes(opts) {
    var server = opts.server;

    //TODO: make these social auth routes more dynamic; currently listed out because of 'auth' route param

    var useFacebook = opts.config && opts.config.security.facebookAppId;
    var useGoogle = opts.config && opts.config.security.googleAppId;

    if (useFacebook) {
        server.route({
            method:     ['GET', 'POST'],
            path:       '/auth/facebook',
            handler:    this.getWebRouteHandler(opts),
            config: {
                auth:   'facebook'
            }
        });
    }

    if (useGoogle) {
        server.route({
            method:     ['GET', 'POST'],
            path:       '/auth/google',
            handler:    this.getWebRouteHandler(opts),
            config: {
                auth:   'google'
            }
        });
    }

    // all other URLs checked against app config files for dymanic web routes
    server.route({
        method:     '*',
        path:       '/{p*}',
        handler:    this.getWebRouteHandler(opts)
    });
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
            serverPreprocessing:    me.getServerPreProcessing(request, reply),
            addToModel:             opts.addToModel,
            pageCacheService:       opts.pageCacheService
        };

        webRouteHandler.processWebRequest(routeInfo, callbacks)
            .then(function (renderedPage) {

                // if no rendered page, it means request was handled earlier somewhere (ex. serverPreprocess redirect)
                if (!renderedPage) {
                    return;
                }

                var response = reply(renderedPage);

                // add content type if in the route info
                if (routeInfo.contentType) {
                    response.header('Content-Type', routeInfo.contentType);
                }

                // as long as the nocache attribute is NOT set, add cache headers (sorry for double negative :-))
                if (!routeInfo.nocache) {
                    response.header('cache-control', 'public, max-age=60');
                }
            })
            .done();    // throw error up to app level error handler
    };
}

module.exports = {
    addWebRoutes: addWebRoutes,
    getWebRouteHandler: getWebRouteHandler,
    getServerPreProcessing: getServerPreProcessing
};