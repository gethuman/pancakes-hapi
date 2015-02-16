/**
 * Author: Jeff Whelpley
 * Date: 10/22/14
 *
 *
 */
var name    = 'pancakes.hapi.web';
var taste   = require('taste');
var hapi    = taste.target(name);

describe('UNIT ' + name, function () {
    describe('addWebRoutes()', function () {
        it('should add 3 routes', function () {
            var routeSpy = taste.spy();
            var opts = { server: { route: routeSpy } };
            var context = { getWebRouteHandler: taste.spy() };
            hapi.addWebRoutes.call(context, opts);
            routeSpy.should.have.callCount(1);
        });
    });
});