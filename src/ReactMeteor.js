var ReactMeteorMixin = {
  componentWillMount: function() {
    var self = this;

    self._meteorStateDep = new Tracker.Dependency();
    self._meteorFirstRun = true;

    if (Meteor.isClient) {
      Tracker.autorun(function(computation) {
        self._meteorComputation = computation;
        self._meteorStateDep.depend();

        if (self.startMeteorSubscriptions) {
          // Calling this method in a Tracker.autorun callback will ensure
          // that the subscriptions are canceled when the computation stops.
          self.startMeteorSubscriptions();
        }

        enqueueMeteorStateUpdate(self);
      });

    } else {
      enqueueMeteorStateUpdate(self);
    }
  },

  componentWillUpdate: function(nextProps, nextState) {
    if (this._meteorCalledSetState) {
      // If this component update was triggered by the ReactMeteor.Mixin,
      // then we do not want to trigger the change event again, because
      // that would lead to an infinite update loop.
      this._meteorCalledSetState = false;
      return;
    }

    if (this._meteorStateDep) {
      this._meteorStateDep.changed();
    }
  },

  componentWillUnmount: function() {
    if (this._meteorComputation) {
      this._meteorComputation.stop();
      this._meteorComputation = null;
    }
  }
};

function enqueueMeteorStateUpdate(component) {
  var partialState =
    component.getMeteorState &&
    component.getMeteorState();

  if (! partialState) {
    // The getMeteorState method can return a falsy value to avoid
    // triggering a state update.
    return;
  }

  if (component._meteorFirstRun) {
    // If it's the first time we've called enqueueMeteorStateUpdate since
    // the component was mounted, set the state synchronously.
    component._meteorFirstRun = false;
    component._meteorCalledSetState = true;
    component.setState(partialState);
    return;
  }

  Tracker.afterFlush(function() {
    component._meteorCalledSetState = true;
    component.setState(partialState);
  });
}

ReactMeteor = {
  Mixin: ReactMeteorMixin,

  // So you don't have to mix in ReactMeteor.Mixin explicitly.
  createClass: function createClass(spec) {
    spec.mixins = spec.mixins || [];
    spec.mixins.push(ReactMeteorMixin);
    var Cls = React.createClass(spec);

    if (Meteor.isClient &&
        typeof Template === "function" &&
        typeof spec.templateName === "string") {
      var template = new Template(
        spec.templateName,
        function() {
          // A placeholder HTML element whose parentNode will serve as the
          // container into which React.render renders the component.
          return new HTML.SPAN;
        }
      );

      template.onRendered(function() {
        React.render(
          // Equivalent to <Cls {...this.data} />:
          React.createElement(Cls, this.data || {}),
          this.find("span").parentNode
        );
      });

      Template[spec.templateName] = template;
    }

    return Cls;
  }
};
