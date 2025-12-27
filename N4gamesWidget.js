
/**
 * A module defining `N4gamesWidget`.
 *
 * @module nmodule/n4games/rc/N4gamesWidget
 */
define([ 'bajaux/Widget', 'jquery', 'Promise' ], function (Widget, $, Promise) {

  'use strict';

  /**
   * Description of your widget.
   *
   * @class
   * @extends module:bajaux/Widget
   * @alias module:nmodule/n4games/rc/N4gamesWidget
   */
  var N4gamesWidget = function N4gamesWidget() {
    Widget.apply(this, arguments);
  };

  //extend and set up prototype chain
  N4gamesWidget.prototype = Object.create(Widget.prototype);
  N4gamesWidget.prototype.constructor = N4gamesWidget;

  /**
   * Describe how your widget does its initial setup of the DOM.
   *
   * @param {jQuery} element the DOM element into which to load this widget
   */
  N4gamesWidget.prototype.doInitialize = function (dom) {
    dom.html('<input type="text" value="value goes here" />');
  };

  /**
   * Describe how your widget loads in a value.
   *
   * @param value description of the value to be loaded into this widget
   */
  N4gamesWidget.prototype.doLoad = function (value) {
    this.jq().find('input').val(String(value));
  };

  /**
   * Describe what kind of data you can read out of this widget.
   *
   * @returns {Promise} promise to be resolved with the current value
   */
  N4gamesWidget.prototype.doRead = function () {
    return Promise.resolve(this.jq().find('input').val());
  };

  return N4gamesWidget;
});

