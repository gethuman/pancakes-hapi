/**
 * Author: Jeff Whelpley
 * Date: 10/15/14
 *
 * This will be the main interface for the Hapi plugin
 */
var _       = require('lodash');
var hapiApi = require('./pancakes.hapi.api');
var hapiWeb = require('./pancakes.hapi.web');

/**
 * Constructor sets up the plugin
 * @param opts
 * @constructor
 */
function PancakesHapiPlugin(opts) {
    this.pancakes   = opts.pluginOptions.pancakes;
    this.jangular   = opts.pluginOptions.jangular;
}

_.extend(PancakesHapiPlugin.prototype, hapiApi, hapiWeb);

// expose class
module.exports = PancakesHapiPlugin;