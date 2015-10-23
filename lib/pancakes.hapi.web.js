/**
 * Copyright 2014 GetHuman LLC
 * Author: Jeff Whelpley
 * Date: 10/21/14
 *
 *
 */
var _ = require('lodash');
var routeHandler;

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
        if ( request.response.statusCode > 399 ) {
            console.log(request.method.toUpperCase() + ' ' + request.url.path + ' -> ' + request.response.statusCode);
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

        try { // this can throw an error (on, say, a 404)...
            routeInfo = webRouteHandler.getRouteInfo(appName, url, request.query, request.app.lang);
        } catch (e) {
            return reply(e);
        }

        var routeHelper = me.pancakes.cook('routeHelper');
        var newrelic = require('newrelic');

        try { // this can throw an error, though not likely now that there's a catch above...
            newrelic.setTransactionName(routeInfo.appName + '||' + routeInfo.lang + '||' + routeInfo.urlPattern);
        } catch (e) {
            console.log('Error while sending to newrelic: ' + e);
            // can we continue...?  guess we should try...
        }

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
                return reply(new Error('So sorry, but there is an error here right now, and we are trying to fix it. Please try again later.'));
            }

            // do full url for all redirects
            if (redirectUrl.indexOf('http') !== 0) {
                redirectUrl = (routeHelper.getBaseUrl(routeInfo.appName) + '') + redirectUrl;
            }

            reply().redirect(redirectUrl).permanent(true);
            return;
        }


        // if the app is handling this request, don't do anything
        if (opts.preProcess && opts.preProcess(request, reply)) { return; }

        var callbacks = {
            serverPreprocessing:    me.getServerPreProcessing(request, reply),
            addToModel:             opts.addToModel,
            pageCacheService:       opts.pageCacheService
        };

        try {
            webRouteHandler.processWebRequest(routeInfo, callbacks)
                .then(function (renderedPage) {

                    // if no rendered page, it means request was handled earlier somewhere (ex. serverPreprocess redirect)
                    if (!renderedPage) {
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
                })
                .done();    // throw error up to app level error handler
        } catch (err) {
            console.log('Error while trying to process request: ' + err);
            reply(new Error('Sorry- there is an error here right now, and we are trying to fix it. Please try again later.'));
        }
    };
}

module.exports = {
    processRoute: processRoute,
    addWebRoutes: addWebRoutes,
    getWebRouteHandler: getWebRouteHandler,
    getServerPreProcessing: getServerPreProcessing
};