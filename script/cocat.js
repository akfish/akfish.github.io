  // $ is not jQuery
(function (ns, $) {
  console.log("CoCat Theme");

  //////////////////////////////////////////////////////////////////////////////
  // Utilities
  //////////////////////////////////////////////////////////////////////////////
  function filter(arr, cb) {
    for (var i = 0; i < arr.length; i++) {
      cb(arr[i], i);
    }
  }

  function map(arr, cb) {
    var result = [];

    for (var i = 0; i < arr.length; i++) {
      result.push(cb(arr[i], i));
    }

    return result;
  }


  //////////////////////////////////////////////////////////////////////////////
  // Event Bus
  //////////////////////////////////////////////////////////////////////////////
  var Event = function() {
    this.handlers = {};
  };

  Event.prototype.trigger = function(evt) {
    if (!this.handlers[evt] || this.handlers[evt].length === 0) return;

    var args = Array.prototype.slice.call(arguments, 1);

    for (var i in this.handlers[evt]) {
      this.handlers[evt][i].apply(undefined, args);
    }

  };

  Event.prototype.on = function(evt, callback) {
    if (!this.handlers[evt]) this.handlers[evt] = [];
    this.handlers[evt].push(callback);
  };

  Event.prototype.off = function(evt) {
    if (!this.handlers[evt] || this.handlers[evt].length === 0) return;
    this.handlers[evt] = [];
  };

  ns.events = new Event();

  //////////////////////////////////////////////////////////////////////////////
  // Duoshuo
  //////////////////////////////////////////////////////////////////////////////

  ns.events.on('duoshuo_ready', function (duoshuo) {
    ns.duoshuo = duoshuo;
    console.log('Duoshuo ready');
    console.log(duoshuo.threadPool);
    console.log(duoshuo.visitor);

    function intercept(dsObj, method, callback) {
      var old = dsObj['_' + method] = dsObj[method].bind(dsObj);
      function newMethod() {
        callback.apply(dsObj, arguments);
        this._reset.apply(this, arguments);
      }
      dsObj[method] = newMethod.bind(dsObj);
    }

    // Or we can use duoshuo.visitor.on('reset', fn)
    intercept(duoshuo.visitor, 'reset', function (v) {
      console.log("Visitor reset!");
      console.log(v);
      ns.events.trigger('visitor_changed', v);
    });

    intercept(duoshuo.threadPool, 'set', function (threads) {
      console.log("Thread pool update!");
      console.log(threads);
      ns.events.trigger('thread_pool_update', threads);
    });

    // Intercept Duoshuo thread
    Object.defineProperty(duoshuo, 'thread', {
      get: function() { return duoshuo._thread; },
      set: function(value) {
        duoshuo._thread = value;
        console.log("Thread ready");
        console.log(value);
        ns.events.trigger("thread_ready", value);
      }
    });
  });

  ns.events.on('thread_ready', function (thread) {
    // DUOSHUO.API.post('threads/vote', {
    //   thread_id: thread.threadId,
    //   vote: 1
    // }, function (data) {
    //   console.log(data);
    // });
  });

  //////////////////////////////////////////////////////////////////////////////
  // Footer social icon
  //////////////////////////////////////////////////////////////////////////////
  var SocialIcon = function(elem) {
    this.el = elem;
    this.iconColor = elem.getAttribute('icon-color');

    elem.addEventListener('mouseover', this.onOver.bind(this));
    elem.addEventListener('mouseout', this.onOut.bind(this));
  };

  SocialIcon.prototype.onOver = function (e) {
    this.el.style.background = this.iconColor;
  };

  SocialIcon.prototype.onOut = function (e) {
    this.el.style.background = 'transparent';
  };


  var footerSocial = $(".footer-socials");

  // ns.socialIcons = map(footerSocial.children, function (icon) {
  //   return new SocialIcon(icon);
  // });

  //////////////////////////////////////////////////////////////////////////////
  // Header
  //////////////////////////////////////////////////////////////////////////////
  var Header = function(elem) {
    // Elements
    this.el = elem;
    this.hamburger = elem.querySelector('.hamburger-menu');
    this.icon = this.hamburger.querySelector('i');
    this.navigation = elem.querySelector('.main-navigation');

    // Initial state
    this.initialHeaderClass = this.el.className;
    this.navVisiable = false;

    this.hamburger.addEventListener('click', this.onHamburgerClick.bind(this));
  };

  Header.prototype.onHamburgerClick = function (e) {
    this.navVisiable = !this.navVisiable;
    if (this.navVisiable) {
      this.el.className = this.initialHeaderClass + " nav-visible";
      this.icon.className = "fa fa-2x fa-times";
    } else {
      this.el.className = this.initialHeaderClass;
      this.icon.className = "fa fa-2x fa-bars";
    }
  };

  ns.header = new Header($("header"));

  //////////////////////////////////////////////////////////////////////////////
  // Post
  //////////////////////////////////////////////////////////////////////////////
  var LikeButton = function(elem, thread) {
    this.el = elem;
    this.link = elem.querySelector('a');
    this.icon = elem.querySelector('.fa');
    this.thread = thread;
    this._voted = this.thread.data.user_vote;
    this._voting = false;

    thread.on('reset', this.onReset.bind(this));
    this.link.addEventListener('click', this.onVote.bind(this));

    this.update();
  };

  LikeButton.prototype.update = function() {
    console.log("Update like button");
    this.icon.className = "fa fa-2 " + (this._voted ? 'fa-heart' : 'fa-heart-o');
  };

  LikeButton.prototype.onVote = function() {
    if (this.voting) {
      console.log("Still voting, abort");
      return;
    }
    var that = this;
    this.voting = true;
    // TODO: start animation
    ns.duoshuo.API.post('threads/vote', {
      thread_id: this.thread.threadId,
      vote: this._voted ? 0 : 1
    }, function (data) {
      // TODO: stop animation
      that.voting = false;
      that._voted = !that._voted;
      that.update();
    });
  };

  LikeButton.prototype.onReset = function() {
    this._voted = this.thread.data.user_vote;
    this.update();
  };

  //////////////////////////////////////////////////////////////////////////////
  // Post
  //////////////////////////////////////////////////////////////////////////////
  var Post = function() {
    this.previewSection = $('#preview');
    this.actionBar = $('#post-action-bar');
    this.postNav = $('.prev-next');

    this.initialBodyClassName = document.body.className;

    var socials = this.actionBar.querySelector('.ds-share');
    var likeBtnEl = this.actionBar.querySelector('.like-button');

    var that = this;
    ns.events.on('thread_ready', function (thread) {
      that.likeButton = new LikeButton(likeBtnEl, thread);
    });

    this.socialIcons = map(socials.children, function (icon) {
      return new SocialIcon(icon);
    });

    document.addEventListener('scroll', this.onScroll.bind(this));
  };

  Post.prototype.onScroll = function (e) {
    var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    var scrolled = scrollTop >= this.previewSection.offsetHeight;
    document.body.className = this.initialBodyClassName + (scrolled ? " scrolled" : "");
  };

  if (ns.isPost) {
    ns.post = new Post();
  }
})(window.CoCat = window.CoCat || {}, document.querySelector.bind(document));
