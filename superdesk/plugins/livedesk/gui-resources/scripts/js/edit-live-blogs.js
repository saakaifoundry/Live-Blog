define([
    'providers/enabled',
    'jquery', 'jquery/splitter', 'jquery/rest', 'jqueryui/droppable',
    'jqueryui/texteditor', 'jquery/utils', 'jquery/avatar',
    'tmpl!livedesk>layouts/livedesk',
    'tmpl!livedesk>layouts/blog',
    'tmpl!livedesk>edit',
    'tmpl!livedesk>edit-timeline'],
    function(providers, $)
    {
        var config = { updateInterval: 5 },
        latestPost = 0,
        providers = $.arrayValues(providers), 
        content = null,
        blogHref = null,
        editorImageControl = function()
        {
            // call super
            var command = $.ui.texteditor.prototype.plugins.controls.image.apply(this, arguments);
            // do something on insert event
            $(command).on('image-inserted.text-editor', function()
            {
                var img = $(this.lib.selectionHas('img'));
                if( !img.parents('figure.blog-image:eq(0)').length )
                    img.wrap('<figure class="blog-image" />');
            });
            return command;
        },
        editorTitleControls = $.extend({}, $.ui.texteditor.prototype.plugins.controls, { image : editorImageControl }),
        h2ctrl = $.extend({}, $.ui.texteditor.prototype.plugins.controls),
        initEditBlog = function(theBlog)
        {
            content = $(this).find('[is-content]');
            var titleInput = content.find('section header h2'),
                descrInput = content.find('article#blog-intro'),
                editorSaveInfo = 
                {
                    _create: function(elements)
                    {
                        $(elements).on('focusout.livedesk', function()
                        {
                            if(!blogHref) return;
                            new $.rest(blogHref).update
                            ({
                                Title: $.styledNodeHtml(titleInput), 
                                Description: $.styledNodeHtml(descrInput)
                            })
                            .done(function()
                            {  
                                content.find('.update-success').removeClass('hide')
                                setTimeout(function(){ content.find('.update-success').addClass('hide'); }, 5000);
                            })
                            .fail(function()
                            { 
                                content.find('.update-error').removeClass('hide')
                                setTimeout(function(){ content.find('.update-error').addClass('hide'); }, 5000);
                            });
                        });
                    }
                };
            
            delete h2ctrl.justifyRight;
            delete h2ctrl.justifyLeft;
            delete h2ctrl.justifyCenter; 
            delete h2ctrl.html;
            delete h2ctrl.image;
            delete h2ctrl.link;
            
            titleInput.texteditor
            ({
                plugins: {controls: h2ctrl, save: editorSaveInfo},
                floatingToolbar: 'top'
            });
            descrInput.texteditor
            ({
                floatingToolbar: 'top', 
                plugins:{ save: editorSaveInfo, controls: editorTitleControls }
            });
            
            $('.tabbable')
            .on('show','a[data-toggle="tab"]', function(e)
            {
                var el = $(e.target);
                var idx = parseInt(el.attr('data-idx'));
                providers[idx].el = $(el.attr('href'));
                providers[idx].init(theBlog);
            })
            .on('hide','a[data-toggle="tab"]', function(e)
                    { console.log('cifi-cif'); });
            
        },
        postHref = null,
        updateInterval = 0,
        updateItemCount = 0,
        updateIntervalInit = function()
        {
            if(!$('#timeline-view:visible', self.el).length) 
            {
                clearInterval(updateInterval);
                return;
            }
            update(); 
        },
        update = function(autoUpdate, callback)
        {
            new $.rest(postHref)
            .request({data:{'startEx.cId':latestPost}})
            .xfilter('Id, CId, Content, CreatedOn, Type, AuthorName, Author.Source.Name, Author.Source.Id, IsModified, Author.Person.*')
            .done(function(posts)
            {
                var posts = $.avatar.parse(this.extractListData(posts));
                if(!posts) return; 
                for(var i=0; i<posts.length; i++)
                    latestPost = Math.max(latestPost, parseInt(posts[i].CId));
                updateItemCount += posts.length;
                
                // trigger update with callback to be applied on click
                posts.length &&
                $('#timeline-view .new-results', content).trigger('update.livedesk', [updateItemCount, function()
                {
                    $.tmpl('livedesk>edit-timeline', {Posts: posts}, function(e, o)
                    {
                        $('#timeline-view .post-list', content).prepend($(o).find('li'));
                        // edit posts
                        $('#timeline-view .post-list li .editable', content)
                            .texteditor({plugins: {controls: h2ctrl}, floatingToolbar: 'top'});
                        updateItemCount -= posts.length;
                    });
                }, autoUpdate]);
                
                callback && callback.apply(this);
            });
        };

        var EditApp = function(theBlog) {
            this.init(theBlog);
        };
        EditApp.prototype = {
            init: function(theBlog)
            {
                this.blogHref = theBlog;
                blogHref = theBlog;
            },
            update: function(){
                clearInterval(updateInterval);
                update(true, function(){ updateInterval = setInterval(updateIntervalInit, config.updateInterval*1000); });
            },
            render: function()
            {
                var self = this;
                new $.restAuth(this.blogHref).xfilter('Creator.Name, Creator.Id').done(function(blogData)
                {
                    var data = $.extend({}, blogData, {ui: {content: 'is-content=1', side: 'is-side=1'}, providers: providers}),
                        content = $.superdesk.applyLayout('livedesk>edit', data, function(){
                            initEditBlog.call(this, self.blogHref);
                            require(['//platform.twitter.com/widgets.js'], function(){ twttr.widgets.load(); });
                        });
                    $('.live-blog-content').droppable({
                        drop: function( event, ui ) {

                            var data = ui.draggable.data('data');
                            var post = ui.draggable.data('post');
                            if(data !== undefined) {
                                new $.restAuth(self.blogHref + '/Post/Published').resetData().insert(data);
                            } else if(post !== undefined){
                                new $.restAuth(self.blogHref + '/Post/'+post+'/Publish').resetData().insert();
                            }
                            // stupid bug in jqueryui you can make draggable desstroy
                            setTimeout(function(){
                                $(ui.draggable).removeClass('draggable').draggable("destroy");
                            },1);
                            // stop update interval -> update -> restart
                            self.update();
                        },
                        activeClass: 'ui-droppable-highlight'
                    });
                    $('#put-live').on('show', function(){
                        console.log('show');
                    }).on('shown', function(){
                            console.log('shown');
                        });
                    $("#MySplitter").splitter({
                        type: "v",
                        outline: true,
                        sizeLeft: 470,
                        minLeft: 470,
                        minRight: 600,
                        resizeToWidth: true,
                        //dock: "left",
                        dockSpeed: 100,
                        cookie: "docksplitter",
                        dockKey: 'Z',   // Alt-Shift-Z in FF/IE
                        accessKey: 'I'  // Alt-Shift-I in FF/IE
                    });

                    $('.collapse-title-page', content).off('click.livedesk')
                        .on('click.livedesk', function()
                        {
                            var intro = $('article#blog-intro', content);
                            !intro.is(':hidden') && intro.fadeOut('fast') && $(this).text('Expand');
                            intro.is(':hidden') && intro.fadeIn('fast') && $(this).text('Collapse');
                        });

                    postHref = blogData.PostPublished.href;
                    this.get('PostPublished')
                        .xfilter('Id, CId, Content, CreatedOn, Type, AuthorName, Author.Source.Name, Author.Source.Id, IsModified, Author.Person.*')
                        .done(function(posts)
                        {
                            var posts = $.avatar.parse(this.extractListData(posts));
                            $('#timeline-view .results-placeholder', content).tmpl('livedesk>edit-timeline', {Posts: posts}, function()
                            {
                                // edit posts
                                $('#timeline-view .post-list li .editable', content)
                                    .texteditor({plugins: {controls: h2ctrl}, floatingToolbar: 'top'});
                                
                                // bind update event for new results notification button
                                $('#timeline-view .new-results', content)
                                    .off('update.livedesk')
                                    .on('update.livedesk', function(e, count, callback, autoUpdate)
                                    {
                                        var self = $(this);
                                        !autoUpdate && self.removeClass('hide').one('click.livedesk', function()
                                        {
                                            self.addClass('hide');
                                            callback.apply(self);
                                        }).find('span').text(count);
                                        autoUpdate && callback.apply(self);

                                    });
                            });

                            for(var i=0; i<posts.length; i++)
                                latestPost = Math.max(latestPost, parseInt(posts[i].CId));

                            clearInterval(updateInterval);
                            updateInterval = setInterval(updateIntervalInit, config.updateInterval*1000);

                        });
                });
            }

        };
        return EditApp;
});