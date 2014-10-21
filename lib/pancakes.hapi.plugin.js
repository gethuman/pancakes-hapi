/**
 * Author: Jeff Whelpley
 * Date: 10/15/14
 *
 * This will be the main interface for the Hapi plugin
 */
var hapiApi = require('./pancakes.hapi.api');
var hapiWeb = require('./pancakes.hapi.web');

// expose functions
module.exports = {
    init: function () {},  // init doesn't do anything for now
    addApiRoutes: hapiApi.addApiRoutes,
    addWebRoutes: hapiWeb.addWebRoutes
};