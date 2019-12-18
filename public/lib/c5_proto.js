/*
    C5 internal prototyping tool

    See this file for documentation: https://docs.google.com/document/d/1DY0eXQsYcm5pNxi_lK8vWC8QwJbsSZLl3uvuacjfSak/edit?usp=sharing
    
    this file contains 2 main functions
    1. display and run the click through, letting users browse through slides, read comments, click hotspots etc
    2. provide the front-end to edit the prototype
        - add, modify, delete a comment
        - add, modify, delete an annotation
        - add, modify, delete a hotspot
        - modify a global hotspot
        - add, delete an instance of a global hotspot on a form
*/


(function () {

    const _self = this;

    /************************** Settings / Variables **************************/

    //a place to store the various json data files that will be loaded
    _self.dataPieces = {
        //users: null,
        global: null,
        feature: null,
        issue: null,
        issueNPO: null,
        assessment: null,
        event: null,
        overlay: null,
        extra: null
    }

    //various DOM Nodes or names of nodes to use for appending content
    _self.mainContext = 'protoWrap';
    _self.wrap = document.querySelector('#' + _self.mainContext);
    _self.commentDrawer = document.querySelector('.commentDrawer');
    _self.modeControls = document.querySelector( '.modeControls ');

    //which mode the prototype is in
    //view = limited functionality, can browse and navigate, can read comments and post questions
    //build = manage hotspots, modify any comment, add annotations, etc
    _self.mode = 'view';
    _self.commentsVisible = true;
    _self.annotationsVisible = true;
    _self.currentModal = null;

    //flag to be used when adding something
    //needed because when true if user clicks anywhere on the screen we'll know what to do with the click.
    _self.addingAnnotation = false;
    _self.addingComment = false;
    _self.addingHotspot = false;

    //TO-DO add in a control to show/hide layers, such as comments
    _self.layers = [
        'comments',
        'annotations'
    ];

    //store the active user
    _self.activeUser = null;
    _self.activeUserAuth = false;






    /************************** Functions **************************/


    /*
        read and write history to be able to create deep links
    */
    this.navigation = {

        /*
            Read the URL params
            If ID and Context params exist then go to the corresponding slide
        */
        read: function () {
            const params = new URLSearchParams(window.location.search);

            if (params.has('id') && params.has('context')) {
                _self.navigation.goTo({
                    id: params.get('id'),
                    context: params.get('context')
                });
            }
        },

        /*
            Write to the browser history
            Also updates the URL as navigation occurs within the app
        */
        write: function (item, context) {
            //console.log('write history', item, context);
            history.pushState({
                    id: item,
                    context: context
                },
                'topic prototype', //title
                `?id=${ item }&context=${ context }` //new URL
            );
        },

        /*
            Go to a specific screen
            Triggered by:
                1. browser back / forward buttons
                2. typing in a side ID and context in the URL - from the navigation.read function
        */
        goTo: function( item ){
            if (item !== null) {

                //if context is main context then close any open overlays
                const openOverlays = _self.wrap.querySelectorAll('.overlay.active');
                if (item.context === _self.mainContext && openOverlays.length > -1) {
                    for (let o of openOverlays) {
                        _self.closeOverlay(o);
                    }
                }

                //if context is not the main context then make sure that overlay is open
                if (item.context !== _self.mainContext) {
                    console.log('not main context');
                    const overlay = _self.wrap.querySelector(`#${ item.context }`);

                    //if overlay hasn't been added to DOM yet
                    if (overlay === null) {
                        _self.overlay(_self.find(item.context, _self.mainContext));
                    }

                    //if it has been, then check to see if it's active
                    else if (!overlay.classList.contains('.active')) {
                        overlay.classList.add('active');
                    }
                }

                //go to the item
                _self.changeItem( item.id, item.context, true);
            } else {
                console.warn("no where to go to")
            }
        },

        /*
            Go back to the previous item stored in the browser history
            Triggered by:
                1. a hotspot using the "back" function
        */
        goBack: function () {
            window.history.back();
        }
    }




    /*
        Find item in data
        Called by:
            1. navigation.goTo()
            2. changeItem()
            3. findSlide()
    */
    this.find = function( id, context ){

        console.log('find data:', id, context);

        let result = null;

        //if context is not the main context then we're looking for data within an overlay
        if( context !== _self.mainContext ){

            //only look within the overlay file
            const overlay = _self.dataPieces.overlay[ context ];
            if( typeof overlay === 'undefined' ){
                console.warn( 'could not find overlay data for id:', id );
                return false;
            }

            //find overlay by name using the provided ID
            result = overlay.items.find( ( o ) => {
                return o.name === id;
            });
            
        }

        //if context is the main context then look for the slide in all the possible data files as defined in the settings section above
        else{
            for( let el in _self.dataPieces ){
                if( typeof _self.dataPieces[ el ][ id ] !== 'undefined' ){
                    result = _self.dataPieces[ el ][ id ];
                }
            }
        }

        return result;
    }



    /*
        change to another item
        remove active one
        usingNav is when the browser history trigger the page to load, not a hotspot.
    */
    this.changeItem = function( nextItem, contextName, usingNav = false ){
        console.log('change item:', nextItem, contextName);

        let context = document.querySelector('#' + contextName);

        //if context is not the main context then it's an overlay that may have not been built yet
        if (context === null) {
            console.log('context not built yet', contextName);
            _self.showOverlay(contextName);
            context = document.querySelector('#' + contextName);
        }

        if (context !== _self.mainContext) {
            context.classList.add('active');
        }

        //hide active item
        _self.hideActive( context );

        //close any open comment modals
        _self.removeActiveComments();

        //find the data for the new slide
        const newItemData = _self.find( nextItem, contextName );

        //determine what to do next. Show the item if it's already in the DOM or add a new DOM node if not.
        //if item already exists then show it
        if (context.querySelectorAll(`#${ nextItem }`).length > 0) {
            context.querySelector(`#${ nextItem }`).classList.add('active');

            //populate the comment drawer
            if (_self.disableComments !== true) {
                _self.populateCommentDrawer(_self.find( nextItem, contextName ), true);
            }
            //push into browser history
            if (usingNav === false) {
                _self.navigation.write(nextItem, contextName);
            }
            //set active var
            _self.activeSlide = newItemData;

            //If in build mode check if this slide is in the drawer or not
            if( _self.mode === 'build' ){
                if( _self.activeSlide.showInDrawer === true ){
                    _self.modeControls.querySelector( '#addToDrawer' ).classList.add( 'active' );
                }else{
                    _self.modeControls.querySelector( '#addToDrawer' ).classList.remove( 'active' );
                }
            }
        }

        //else load it
        else {

            _self.node( newItemData, context, contextName, usingNav );
        }


    }


    /*
        Load an individual item
        Setup it's hotspots and click events
    */
    this.node = function( el, wrap = this.wrap, contextName, usingNav ) {

        console.log('loading item:', el, contextName);


        //sometimes we specify a node name that doesn't exist in the data
        if( typeof el === 'undefined' || el === null ){
            console.warn( 'node does not exist in data' );
            _self.showEmptyState( wrap );
            return false;
        }

        let nodeType = 'slide';

        //if creating a node within an overlay
        if( wrap !== _self.wrap ){
            nodeType = 'overlay'
        }

        const status = typeof el.status !== 'undefined' ? el.status : 'No Status';

        //get comments
        //get comment count and subtract any
        const commentOnNode = this.getComments( el ) ;
        let commentCount = 0;
        if( commentOnNode !== null ){
            commentCount = commentOnNode.length;
            for( let c of commentOnNode ){
                if( c.type === 'deleted' ){
                    commentCount--;
                }
            }
        }
       

        const node = document.createElement('div');
        node.id = el.name;
        node.className = "item active";
        node.innerHTML = `
            ${ el.img === null ? '' : `<img class="image" src="img/${ el.img }" />` }
            <div class="hotspots"></div>
            <div class="comments"></div>
            <div class="metadata">
                <span class='lastUpdated timestamp'>Last Updated: <span id='lastMod'></span></span>
                <span class='status' data-status='${ status }'><span>Status:</span> <span class="status-indicator">${ status }</span></span>
                <button id="allCommentsByModule" class="button button--rounded" data-file="${ el.file }">All <span style="text-transform: capitalize;">${ el.file }</span> Comments</button>
                ${ commentOnNode !== null ?
                    `<span class='meta-comments button button--rounded'><span class='count'>${ commentCount }</span> Comments on this page</span>`
                    :
                    ''
                }
            </div>
        `;

        wrap.appendChild(node);

        //append the hotspots to the whole screen
        if (typeof el.hotspots === "object") {
            for (let h of el.hotspots) {

                //for directly defined hotspots
                if( typeof h !== 'undefined' && h.link !== "" && typeof h.link !== 'undefined' ){
                    let newHotspot = _self.hotspot(h, wrap);
                    if( newHotspot !== false ){
                        node.querySelector('.hotspots').appendChild( newHotspot );
                    }
                } 
                
                //for global hotspots
                else if( h.type === 'global' ){

                    if( h.state === 'deleted' ){
                        continue;
                    }

                    //check if global hotspot data is loaded
                    //if not defined wait until it is then run
                    if( typeof _self.dataPieces.global === 'undefined' ){
                        _self.appendHotspotsWhenDataIsLoaded(
                            'global',
                            node,
                            h,
                            wrap
                        );
                    }
                    
                    //if data already loaded then just use it
                    else{
                        const globalH = _self.dataPieces.global[ h.name ];
                        if( typeof globalH === 'undefined '){
                            console.log( 'global hotspot not found', h.name );
                        }
                        
                        else{
                            let hotspot = _self.hotspot(
                                _self.dataPieces.global[ h.name ],
                                wrap,
                                true
                            )
                            if( hotspot !== false ){
                                node.querySelector('.hotspots').appendChild( hotspot );
                            }
                            
                        }
                    }
                    
                }

                //catch for badly formatted hotspots
                else {
                    console.error('hotspot data not valid', h);
                }

            };
        }

        //append any comments to the whole screen
        //comments within a scrollZone are handled with the scrollZone function
        el.commentsNum = 1;
        if (typeof el.comments === "object") {
            if (_self.disableComments !== true) {
                for (let c of el.comments) {
                    let comment = this.comment( c, wrap, el );
                    //if comment is soft deleted the comment function will return false
                    if( comment !== false ){
                        node.querySelector('.comments').appendChild( comment );
                        el.commentsNum++;
                    }                    
                };
            }
        }
        if( commentOnNode !== null ){
            node.querySelector( '.metadata .meta-comments' ).addEventListener( 'click', function(){ 
                document.querySelector('.slidesAndCommentsWrap').classList.toggle('hideComments');
            });
        }

        //append any scroll zones, which can have their own internal hotspots or comments
        if (typeof el.scrollZones === "object") {
            for (let s of el.scrollZones) {
                node.appendChild( _self.scrollZone( s, wrap, node, el ) );
            }
        }

        //populate the comment drawer
        if (_self.disableComments !== true) {
            _self.populateCommentDrawer( el, true );
        }

        //push into browser history
        if( usingNav === false ){
            _self.navigation.write( el.name, contextName);
        }

        //set active var
        _self.activeSlide = el;

        //find the last modified date of the image
        if( el.img !== null ){
            this.getImageModData( node, el );
        }
       
        //handle status area click
        if( _self.mode === 'build' ){
            node.querySelector( '.metadata .status' ).onclick = function(){
                event.stopPropagation();
                _self.changeStatus();
            }
            //check if this slide is in the drawer or not
            if( _self.activeSlide.showInDrawer === true ){
                _self.modeControls.querySelector( '#addToDrawer' ).classList.add( 'active' );
            }else{
                _self.modeControls.querySelector( '#addToDrawer' ).classList.remove( 'active' );
            }
        }

        node.querySelector( '#allCommentsByModule' ).onclick = function(){
            console.log( 'load all comments from a file' );
            _self.getCommentsByModule( this.getAttribute( 'data-file' ) );
        }

    };

    /*
        When a slide cannot be found show an empty state screen
    */
    this.showEmptyState = function( wrap ){
        console.log( wrap );
        const node = document.createElement('div');
        node.className = "item emptyState active";
        node.innerHTML = `
            <img class="emptyState--image" src="/lib/img/no-results.png" />
            <p class="emptyState--header">Slide Not Found</p>
            <p class="emptyState--message">This can happen for several reasons including an incorrect ID entered in the URL or a hotspot with an incorrect link.</p>
            <a href="javascript:window.history.back()"><button class="button">Go Back</button></a>
            <div class="metadata"></div>
        `;
        document.querySelector( '.slidesAndCommentsWrap' ).classList.add( 'hideComments' );
        wrap.appendChild( node ) ;
    }

    /*
        add overlay
    */
    this.overlay = function (el, item = 0, positionOverride) {

        console.log('creating overlay', el);

        const overlay = document.createElement('div');
        overlay.id = el.name;
        overlay.className = `overlay ${ el.align === 'bottom' ? 'bottom' : ''} active`;

        //if overlay should be positioned differently than the default, use the new position
        if (typeof positionOverride !== 'undefined' && positionOverride !== null) {
            const pos = positionOverride.split(',');
            overlay.setAttribute(
                "style",
                `width: ${ el.location.w }px;
                height: ${ el.location.h }px;
                top: ${ pos[1] }px;
                left: ${ pos[0] }px;`
            );
        }
        //set back to default in case it was changed previous
        else {
            overlay.setAttribute(
                "style",
                `width: ${ el.location.w }px;
                height: ${ el.location.h }px;
                top: ${ el.location.y }px;
                left: ${ el.location.x }px;`
            );
        }


        _self.wrap.appendChild( overlay );
        

        //load first item
        _self.node( el.items[ item ], overlay, el.name, false );

        //if overlay needs the translucent overlay over the app
        if (el.showOverlayBackground === true) {
            _self.wrap.classList.add('overlayBackground');
        }

        //_self.navigation.write(el.items[0].id, el.name );

    };

    /*
        Show an overlay
        o = id for overlay
    */
    this.showOverlay = function (o, positionOverride) {
        let overlayName = o;
        let overlayStartSlideName = null;

        console.log( overlayName );

        //check if starting on the first item of the overlay, or if specified an item to start from
        const startFirstItem = overlayName.match(/\[.*?\]/g) !== null ? false : true;
        if (startFirstItem === false) {
            overlayName = o.substring(0, o.indexOf("["));
            overlayStartSlideName = o.match(/\[.*?\]/g)[0].slice(1, -1).trim();
        }

        console.log( overlayName, overlayStartSlideName, startFirstItem );


        //get the data for the overlay
        const overlay = _self.dataPieces.overlay[ overlayName ];

        if( typeof overlay === 'undefined' ){
            console.warn( 'could not find an overlay with ID:', overlayName );
            return false;
        }

        //find the index of the item to start on, default 0
        let overlayIndex = 0;
        let overlayItem = overlay.items[ 0 ];
        if (startFirstItem === false) {
            overlayIndex = overlay.items.findIndex( i => {
                return i.name === overlayStartSlideName;
            });
            overlayItem = overlay.items[ overlayIndex ];
        }

        const existingOverlay = _self.wrap.querySelector(`#${ overlayName }`);

        //show the overlay if it already existing
        if (existingOverlay !== null) {
            console.log( 'show existing overlay' );

            //if overlay should be positioned differently than the default, apply the new position
            if (positionOverride !== null) {
                const pos = positionOverride.split(',');
                existingOverlay.style.left = `${ pos[0] }px`
                existingOverlay.style.top = `${ pos[1] }px`
            }
            //set back to default in case it was changed previous
            else {
                existingOverlay.style.left = `${ overlay.location.x }px`
                existingOverlay.style.top = `${ overlay.location.y }px`
            }

            //show the overlay itself
            existingOverlay.classList.add('active');

            //if the item exists within the overlay
            const existingOverlayItem = existingOverlay.querySelector(`#${ overlayItem.name }`);
            if (existingOverlayItem !== null) {
                //hide any existing items
                for (let i of existingOverlay.querySelectorAll('.active')) {
                    i.classList.remove('active');
                }

                //show the right item within the overlay
                existingOverlayItem.classList.add('active');

            }

            //item does not yet existing within existing overlay
            else {
                _self.changeItem(
                    overlayItem.name,
                    overlayName
                );
            }

            //if overlay needs the translucent overlay over the app
            if (overlay.showOverlayBackground === true) {
                console.log('show overlay background');
                _self.wrap.classList.add('overlayBackground');
            }

            //update the history
            _self.navigation.write(
                existingOverlay.querySelector('.active').getAttribute('id'),
                overlayName
            );
        }

        //if it doesn't exist then write it to the DOM
        else {
            _self.overlay(overlay, overlayIndex, positionOverride);
        }
    }

    /*
        Close an overlay
    */
    this.closeOverlay = function (el) {
        console.log('close overlay');
        el.classList.remove('active');
        _self.wrap.classList.remove('overlayBackground');
    };

    /*
        Open external link in New Tab
    */
    this.openExternalLink = function (link) {
        console.log('open external link', link);
        window.open(link, '_blank');
    }

    /*
        Get Hotspots for a given node
    */
    this.getHotspots = function( item ){
        let hotspots = null;
        if( typeof item.hotspots === 'object' && item.hotspots.length > 0) {
            hotspots = item.hotspots;
        }
        if (typeof item.scrollZones === 'object') {
            for (let s of item.scrollZones) {
                if (typeof s.hotspots === 'object' && s.hotspots.length > 0) {
                    if( hotspots !== null ){
                        hotspots = hotspots.concat( s.hotspots );
                    } else {
                        hotspots = s.hotspots;
                    }

                }
            }
        }
        return hotspots;
    }
    /*
        append a single hotspot to a node
    */
    this.hotspot = function( h, wrap, isGlobal = false, isNewHotspot = false ){
        //console.log( h );

        //if hotspot data isn't found for some reason then return an empty div
        //returning null currently breaks stuff
        if( typeof h === 'undefined' ){
            console.warn( 'hotspot data cannot be found', h );
            return false;
        }

        //if hotspot is type=deleted
        //global hotspots where the instance have been deleted use the state prop instead.
        if( h.type === 'deleted' || h.state === 'deleted' ){
            return false;
        }

        //add an ID to the data for this hotspot to make updating easier
        //ID for a hotspot is currently undefined
        if( typeof h.id === 'undefined' ){
            h.id = _self.createGuiID();
        }

        let result = document.createElement('div');
        result.id = h.id;
        result.className = 'hotspot';
        result.setAttribute(
            "style",
            `width: ${ h.w }px;
            height: ${ h.h }px;
            top: ${ h.y }px;
            left: ${ h.x }px;`
        );
        result.setAttribute( 'data-file', h.file );
        result.setAttribute( 'data-node', h.name );

        //if this is a new hotspot
        if( isNewHotspot === true ){
            result.setAttribute( 'data-new', true );
        }

        if (typeof h.type === 'undefined') {
            h.type = 'click';
        }

        if( isGlobal === true ){
            result.className += ' hotspot_global';
        }

        result.setAttribute('type', h.type);

        if (h.type === "overlay") {
            result.setAttribute('overlay-link', h.link);
            if (typeof h.position !== 'undefined') {
                result.setAttribute('overlay-position', h.position);
            }
        } else if (h.type === "external") {
            result.setAttribute('external-link', h.link);
        } else {
            result.setAttribute('data-link', h.link);
            result.setAttribute('data-context', wrap.getAttribute('id') );
        }

        if (h.type === 'hover') {
            result.onmouseenter = this.hotspotClick;
        } else {
            result.onclick = this.hotspotClick;
        }

        //if in build mode make hotspot draggable
        if( _self.mode === 'build' ){
            //result.setAttribute('data-state', 'newHotspot' );
            _self.makeHotspotDraggable( result, h );
        }

        return result;
    };

    /*
        When a hotspot depends on data being loaded first
        This function will wait until data is loaded then run
        Make sure data is in the process of being fetched before using this function
    */
   this.appendHotspotsWhenDataIsLoaded = function( data, node, h, wrap ){
        function checkData(){
            if( typeof _self.dataPieces[ data ] !== 'undefined' ){
                //console.log( 'data ready, load hotspot', h );
                node.querySelector('.hotspots').appendChild(
                    this.hotspot(
                        _self.dataPieces[ data ][ h.name ],
                        wrap,
                        true
                    )
                );
            }else{
                setTimeout( checkData, 500 );
            }
        }
        checkData();
   }

    /*
        trigger transition on hotspot click
    */
    this.hotspotClick = function( event ){

        console.log( 'hotspot click', event  );

        event.stopPropagation();

        //if in build mode primary action of clicking a hotspot is to edit it
        if( _self.mode === 'build' ){

            //shift + click to follow hotspot
            if( event.shiftKey === true ){
                _self.followHotspot( this );
                return false;
            }

            //to see the hotspot dialog use double-tap
            //_self.editHotspot( event, this );

        }else{
            _self.followHotspot( this );
        }        
    }

    /*
        Navigate / perform hotspot action
    */
    this.followHotspot = function( h ){
        let type = h.getAttribute('type');

        if (type === 'click' || type === 'hover') {

            let nextItem = h.getAttribute('data-link');

            //determine context, where to load new item (main area or within an overlay)
            const contextName = h.getAttribute('data-context');

            //if function [functions can be run anywhere but are mostly used in overlays]
            if( nextItem.includes('function_') === true ){
                console.log('run function');

                const functionName = nextItem.slice(9);

                //go back
                if (functionName === 'back') {
                    _self.navigation.goBack();
                }

                //close the overlay
                if (functionName === 'closeOverlay') {
                    _self.closeOverlay(_self.getParent(h, '.overlay'));
                }

                //close and go somewhere else in context [ main context is assumed unless declared differently ]
                if (functionName.includes('breakOverlay')) {
                    console.log('breakOverlay');

                    //get name
                    nextItem = functionName.match(/\[.*?\]/g)[0].slice(1, -1).trim();

                    _self.closeOverlay(_self.getParent(h, '.overlay'));

                    let context = _self.mainContext
                    if (nextItem.includes(',')) {
                        const pieces = nextItem.split(',');
                        context = pieces[1].trim();
                        nextItem = pieces[0];
                    }

                    _self.changeItem(nextItem, context);

                }

                //launch another overlay from current overlay
                if (functionName.includes('newOverlay')) {
                    newOverlay = functionName.match(/\[.*?\]/g)[0].slice(1, -1);
                    console.log(newOverlay);
                    _self.showOverlay(newOverlay);
                }
            }

            //else normal hotspot
            else {
                _self.changeItem(nextItem, contextName);
            }
        }

        //open the overlay
        else if (type === "overlay") {
            _self.showOverlay(
                h.getAttribute('overlay-link'),
                h.getAttribute('overlay-position')
            );
        }

        //open the external link
        else if (type === "external") {
            _self.openExternalLink(this.getAttribute('external-link'))
        }

        //open the link in a new window
        else if (type === "newWindow") {
            const url = `${ window.location.pathname }?id=${ h.getAttribute( 'data-link' ) }&context=${ h.getAttribute( 'data-context' ) }`;  
            window.open( url, '_blank' );
        }
    }


    /*
        append a single comment to a node
    */
    this.comment = function( c, wrap, wrapData, isNewComment ){

        //if type is deleted the comment has been soft deleted so should be hidden
        if( c.type === 'deleted' ){
            return false;
        }

        let showEditControls = false;
        if( _self.mode === 'build' ){
            showEditControls = true;
        } 
        if( c.user === _self.activeUser ){
            showEditControls = true;
        }

        //update the comment data to include info about the parent
        //if wrapData has a parent it's a scrollzone
        /*if( typeof wrapData.parent !== 'undefined' ){
            c.parent = {
                file: wrapData.parent.file,
                name: wrapData.parent.name,
                scrollZone: wrapData.id
            }
        }else{
            c.parent = {
                file: wrapData.file,
                name: wrapData.name
            }
        }*/

        //add an ID to the data for this comment to make updating easier
        //ID is currently a unique sequence per Slide
        if( typeof c.id === 'undefined' ){
            c.id = _self.createGuiID();
        }
        
        let result = document.createElement('div');
        result.setAttribute( 'id', c.id );
        result.className = 'comment';

        result.setAttribute(
            "style",
            `top: ${ c.y }px;
            left: ${ c.x }px;`
        );

        //add data attribute for type
        let type = typeof c.type === 'undefined' ? 'comment' : c.type;
        result.setAttribute('data-type', type);

        //add data for where to find this comment in the data
        result.setAttribute('data-file', c.file );
        result.setAttribute('data-node', c.name );

        //add flag for resolved
        if( typeof c.resolved !== 'undefined' ){
            result.setAttribute( 'data-resolved', c.resolved )
        }
        
        //if nested inside an overlay this is the slide within the overlay
        if( typeof c.itemName !== 'undefined' ){
            result.setAttribute('data-itemName', c.itemName );
        }
        if( typeof c.parent !== 'undefined' ){
            result.setAttribute('data-node', c.parent );
            result.setAttribute('data-itemName', c.name );
        }

        //if nested inside a scrollZone
        if( typeof c.scrollZone !== 'undefined' ){
            result.setAttribute('data-scrollZone', c.scrollZone );
        }


        if( typeof wrapData !== "undefined" ){
            result.setAttribute( 'data-wrapWidth', wrapData.w );
        }
        if (typeof c.widthOverride !== "undefined") {
            result.setAttribute('data-widthOverride', c.widthOverride);
        }
        result.onclick = this.commentClick;

        //if new comment trigger click
        if( isNewComment === true ){
            result.setAttribute( 'data-new', true );
            setTimeout( function(){
                result.click();
            },500 );
            
        }

        //if in build mode
        //make comment draggable to update it's position
        if( showEditControls === true ){
            _self.makeCommentDraggable( c, result, isNewComment );
        }
        

        return result;
    };


    /*
        show comment on click
        Get the comment clicked on, find the data for the comment, render a modal for that node outside of the wrap of the comment itself so that it doesn't get cropped off.
    */
    this.commentClick = function(){

        event.stopPropagation(); //don't trigger the normal hotspot highlight effect or other click events.

        //find the comment node
        const commentNode = _self.getParent( event.target, '.comment' );
        if( commentNode === null ){
            console.warn( 'could not find the comment node, exiting');
            return false;
        }

        //if new comment or existing
        const isNewComment = commentNode.getAttribute( 'data-new' ) === 'true' ? true : false;
        const isOverlay = _self.getParent( commentNode, '.overlay' );

        //find the comment data
        let commentData = null;

        //if new comment the data isn't yet saved into the JSON file.
        if( isNewComment === true ){
            console.log( 'new comment' );

            //base set of data
            commentData = {
                id: commentNode.getAttribute( 'id' ),
                type: _self.mode === 'build' ? 'logic' : 'comment',
                x: commentNode.offsetLeft,
                y: commentNode.offsetTop,
                comment: '',
                user: _self.activeUser,
                file: commentNode.getAttribute( 'data-file' ),
                name: commentNode.getAttribute( 'data-node' )
            }

            //if overlay then need to update the name.
            //name as selected above would be the name of the item, but overlays have 2 layers of items and name is intended to be the higher level one
            if( isOverlay !== null ){
                commentData.itemName = _self.getParent( commentNode, '.item' ).getAttribute( 'id' );
            } 

            //if within a scrollZone adjust
            if( commentNode.getAttribute( 'data-scrollZone' ) !== null ){
                commentData.scrollZone = commentNode.getAttribute( 'data-scrollZone' );
            }
        }
        
        //existing comment, get comment data from file
        else{
            let data = _self.dataPieces[ commentNode.getAttribute( 'data-file' ) ][ commentNode.getAttribute( 'data-node' )];

            if( isOverlay !== null ){
                let item = commentNode.getAttribute( 'data-itemname' );
                data = data.items.find( (i) => {
                    return i.name === item;
                });
            }

            commentData = _self.getComment( data, commentNode.getAttribute( 'id' ) );
        }
        

        if( typeof commentData === 'undefined' ){
            console.warn( 'cound not find the comment data, exiting' );
            return false;
        }
    

        //let wrapWidth = parseInt(commentNode.getAttribute('data-wrapWidth'));
        const commentSize = _self.mode === 'build' ? 460 : 340;

        //hide any other comments that are open
        let openComments = _self.wrap.querySelectorAll( '.comment.active' );
        if( openComments.length > 0 ){
            for( let c of openComments ){
                if( _self.getParent( c, '.comment' ) !== event.target ){
                    c.remove();
                }
            }
        }


        //show the comment detail modal
        console.log('show the comment', '- is new comment:', isNewComment);


        //flags for which controls to show (update, delete etc)
        let showEditControls = false;
        let showDelete = false;
        let typeOptions = '';
        if( _self.mode === 'build' ){
            showEditControls = true;
            showDelete = true;
            typeOptions = `
                <option value="logic" ${ commentData.type === 'logic' ? 'selected' : null }>Logic</option>
                <option value="notification" ${ commentData.type === 'notification' ? 'selected' : null }>Notification</option>
                <option value="comment" ${ commentData.type === 'comment' ? 'selected' : null }>Note</option>
                <option value="question" ${ commentData.type === 'question' ? 'selected' : null }>Question</option>
                <option value="design" ${ commentData.type === 'design' ? 'selected' : null }>Design Note</option>
            `;
        }
        else if( commentData.user === _self.activeUser ){
            showEditControls = true;
            showDelete = true;

            //the only types that can be picked outside build mode are Note and Question, but if logic or notification are the current type then they need to be an option still
            typeOptions = `
                ${ commentData.type === 'logic' ? `
                    <option value="logic" selected disabled>Logic</option>
                ` : ''
                }
                ${ commentData.type === 'notification' ? `
                    <option value="notification" selected disabled>Notification</option>
                ` : ''
                }
                <option value="comment" ${ commentData.type === 'comment' ? 'selected' : null }>Note</option>
                <option value="question" ${ commentData.type === 'question' ? 'selected' : null }>Question</option>
            `;
            if( isNewComment === true ){
                showEditControls = true;
                typeOptions = `
                    <option value="comment" ${ commentData.type === 'comment' ? 'selected' : null }>Note</option>
                    <option value="question" ${ commentData.type === 'question' ? 'selected' : null }>Question</option>
                `
            }
        }
        let resolve = `
            <div class="resolve">
                <input type="checkbox" id="resolveComment" data-resolved='${ typeof commentData.resolved !== 'undefined' ? commentData.resolved : 'false' }' ${ commentData.resolved === true ? 'class="checked"' : ''}>
                <label>${ commentData.resolved === true ? 'Marked Completed' : 'Mark as Completed'}</label>
            </div>
        `

        let user = null;
        if( typeof commentData.user !== 'undefined' ){
            user = _self.findUser( commentData.user );
        }




        /*
            create the new comment node
            outside the current wrap so it isn't cropped off
            TO DO: bind it to the node so it scrolls with it
            also could consider using a positional modal instead of this custom modal.
        */

        const expandedComment = document.createElement('div');
        expandedComment.id = commentData.id;
        expandedComment.className = `comment expanded active`;

        //get comment absolute position
        const commentNodePosition = _self.getAbsolutePosition( commentNode );

        //set position
        expandedComment.setAttribute(
            "style",
            `top: ${ commentNodePosition.y }px;
            left: ${ commentNodePosition.x }px;`
        );

        //set the type
        let type = typeof commentData.type === 'undefined' ? 'comment' : commentData.type;
        expandedComment.setAttribute('data-type', type);

         //if comment would go off the screen set the position to right
        //determine if the comment content should render to the left or to the right of the comment node
        let wrapWidth = 1400;
        const commentPos = commentNode.offsetLeft;
        let position = 'left';
        if( ( commentPos + commentSize ) > wrapWidth ){
            position = 'right';
        }
        expandedComment.setAttribute('data-pos', position);

        let commentContent = commentData.comment;
        if( commentContent.length > 0 ){
            commentData.comment.trim()
        }

        //set the content of the modal
        expandedComment.innerHTML = `
            <div class='comment-content ${ showEditControls === true ? 'edit-mode' : '' }' style="width: ${ commentSize }px">
                ${ showEditControls === true ? `
                    <span class='comment-value' contenteditable='true'><!--${ commentContent }--></span>
                `: `
                    <span class='comment-value'>${ commentContent }</span>
                `}
                <div class="user">${ user !== null ? user.first_name : 'N/A' }</div>

                ${ showEditControls === true ? `
                    <div class="comment-settings">
                        <div class="modal-input select">
                            <label>Comment Type</label>
                            <select id="comment-type">
                                ${ typeOptions }
                            </select>
                        </div>
                    </div>
                    ${ isNewComment !== true ? resolve : `` }
                    <div class="actions">
                        ${ typeof commentData.updatedOn !== 'undefined' ? `
                            <span class="timestamp">${ _self.humanDate( commentData.updatedOn, true ) }</span>
                        `: ''
                        }
                        ${ showDelete === true ? `
                            <button
                                id="deleteComment"
                                class="button button--icon destructive"
                            >
                                <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                                    <g fill-rule="evenodd">
                                        <path d="M14,27 C14,28.1 14.9,29 16,29 L24,29 C25.1,29 26,28.1 26,27 L26,15 L14,15 L14,27 Z M16,17 L24,17 L24,27 L16,27 L16,17 Z M23.5,12 L22.5,11 L17.5,11 L16.5,12 L13,12 L13,14 L27,14 L27,12 L23.5,12 Z" fill-rule="nonzero"></path>
                                    </g>
                                </svg>
                            </button>
                        `: ''}
                        <button
                            id="updateComment"
                            class="button"
                        >${ isNewComment === true ? 'Save New Comment' : 'Update' }</button>
                    </div>
                `: `
                    ${ isNewComment !== true ? resolve : `` }
                    <span class="timestamp">
                    ${ typeof commentData.updatedOn !== 'undefined' ? `
                        ${ _self.humanDate( commentData.updatedOn, true ) }
                    `: 'Not sure when this comment was made...'
                    }
                    </span>
                `}
            </div>
        `;

        if( showEditControls === true ){

            //for new comments not yet saved into the data
            if( isNewComment === true ){
                expandedComment.querySelector( '#updateComment' ).onclick = function(){
                    event.stopPropagation();

                    const btn = this;

                    //disable the button so it can't be clicked over and over
                    btn.classList.add( 'disabled' );


                    //run the new comment function
                    _self.newComment( commentData, expandedComment, function( res, returnedData ){

                        //callbac; when successful.
                        //not called if there was an error creating the comment

                        //add the comment to the data that currently exists on this page
                        //on page refresh it will pull what's in the database, but we need that data to be available now also.
                        let commentForm = _self.dataPieces[ returnedData.file ][ returnedData.name ];
                        if( isOverlay !== null ){
                            let item = returnedData.itemName;
                            commentForm = commentForm.items.find( (i) => {
                                return i.name === item;
                            });
                        }
                        if( typeof commentData.scrollZone !== 'undefined' ){
                            commentForm = commentForm.scrollZones.find( ( s ) => {
                                return s.id === commentData.scrollZone;
                            });
                        }
                        commentForm.comments.push( returnedData );

                        //remove the new comment flag from this comment
                        commentNode.setAttribute( 'data-new', false );

                        //close the modal
                        expandedComment.remove();
    
                    } );
                }

                //new comment, not saved, just delete nodes
                expandedComment.querySelector( '#deleteComment' ).onclick = function(){
                    event.stopPropagation();
    
                    commentNode.remove();
                    expandedComment.remove();
                }
            }

            //for already saved comments
            else{
                expandedComment.querySelector( '#updateComment' ).onclick = function(){
                    event.stopPropagation();
                    _self.updateComment( commentData, expandedComment, function(){
                        _self.updateCommentCallback( commentNode, commentData );
                    } );
                }
    
                expandedComment.querySelector( '#deleteComment' ).onclick = function(){
                    event.stopPropagation();
    
                    _self.deleteComment( commentData, ( data ) => {
                        //delete the comment node
                        if( data.status !== 'error' ){
                            commentNode.remove();
                            expandedComment.remove();
                        }
                    } );
                }
            }

            expandedComment.querySelector( ".comment-settings" ).onclick = function( event ){
                event.stopPropagation();
            }
        }


        //for non-new comments only
        //whether in edit or not edit mode
        if( isNewComment === false ){
            expandedComment.querySelector( '#resolveComment' ).onclick = function(){
                event.stopPropagation();
                let resolve = expandedComment.querySelector( '#resolveComment' );
                if( resolve.getAttribute( 'data-resolved' ) === 'true' ){
                    commentData.resolved = false;
                }else{
                    commentData.resolved = true;
                }
                _self.updateComment(
                    commentData,
                    expandedComment,
                    ( data ) => {
                        expandedComment.remove();
                        commentNode.setAttribute( 'data-resolved', commentData.resolved );
                    },
                    true
                );
            }
        }

        //prevent click bubbling up
        expandedComment.onclick = function(){
            event.stopPropagation();
        }

        _self.wrap.appendChild( expandedComment );


        //if build mode
        if( _self.mode === 'build' ){
           

            //focus the input field
            expandedComment.querySelector( '.comment-value' ).focus();

            //prevent clicks on the input field triggering this function again
            expandedComment.querySelector( '.comment-value' ).onclick = function( e ){
                e.stopPropagation();
            }
        }

        let quillOptions = {
            modules: {
              toolbar: [
                ['bold', 'italic', 'underline'],
                ['link'],
                ['clean']
              ]
            },
            placeholder: 'Write a comment',
            theme: 'bubble'
        };
        if( showEditControls === false ){
            quillOptions.readOnly = true;
        }

        //this.quill.formatText(range, 'bold', true);

        //setup the Quill Editor
        _self.commentEditor = new Quill(
            `.comment.expanded .comment-value`,
            quillOptions
        );

        //with the Quill editor we'll have plain text string and formatted text objects to use
        //older comments will just be plain strings
        if( typeof commentData.quill !== 'undefined' ){
            _self.commentEditor.setContents( commentData.quill );
        }else{
            _self.commentEditor.setText( commentContent );
        }

        //use the selection change event within the Quill Editor to do stuff
        _self.commentEditor.on('selection-change', range => {
            // if range is null then the quill instance has lost focus or is completely gone - this happens when a comment closes
            if( range !== null ){
                //if range length is 0 then nothing is selected, see if we can hide the tooltip
                if( range.length === 0 ){
                    document.querySelector( '.ql-tooltip' ).classList.add( 'hide' );
                }else{
                    document.querySelector( '.ql-tooltip' ).classList.remove( 'hide' );
                }
            }
        });

        _self.commentEditor.on('bold', function(){ console.log( 'bold' ); });

    }
    

    /*
        Populate the comment drawer with all the comments on the current slide
        Can be called by a slide or by an overlay with comments
    */
    this.populateCommentDrawer = function( item, reset ){
        //reset the comment draw, removing all comments if needed
        if (reset === true) {
            _self.commentDrawer.innerHTML = '';
            _self.commentDrawer.classList.remove('noComments')
        }

        //find all the comments associated with the item (either slide or overlay)
        let comments = this.getComments( item );

        //if no comments found quit this function
        if (comments === null) {
            document.querySelector('.slidesAndCommentsWrap').classList.add('hideComments');
            _self.commentDrawer.classList.add('noComments')
            return false;
        }

        //create a node for each comment and load it into the drawer
        let iteration = 1;
        for (let c of comments) {

            //if type is deleted the comment has been soft deleted, don't render
            if( c.type === 'deleted' ){
                continue;
            }

            const commentNode = document.createElement('div');
            commentNode.id = c.id;
            commentNode.className = "comment";

            if( typeof c.type === 'undefined' ){
                c.type = 'comment';
            }
            commentNode.setAttribute( 'data-type', c.type );
            commentNode.setAttribute( 'data-commentNum', iteration );
            if( typeof c.resolved !== 'undefined' ){
                commentNode.setAttribute( 'data-resolved', c.resolved );
            }
            iteration++;

            //if this comment is using quill then display the formatted data
            if( typeof c.quill !== 'undefined' ){
                commentContents = c.quill;
                
                commentNode.innerHTML = `<div class='comment-value'></div>`;

                const commentQuill = new Quill(
                    commentNode.querySelector( '.comment-value' ),
                    {
                        modules: {},
                        placeholder: 'Write a comment',
                        theme: 'bubble',
                        readOnly: true
                    }
                );
                commentQuill.setContents( c.quill );
            }
            
            //if its an old comment then just display the plain text
            else{
                commentNode.innerHTML = c.comment;
            }

            _self.commentDrawer.appendChild( commentNode );

            commentNode.onclick = function( e ){
                e.stopPropagation();
                const commentBubble = _self.wrap.querySelector( `.item.active .comment[id='${ c.id }']` );
                if( commentBubble !== null ){
                    commentBubble.click();
                }
            }
        }
    }


    /*
        create scrollable zone
    */
    this.scrollZone = function( s, wrap, node, nodeData ){
        //console.log("create scroll zone", s);

        //update the data to add some reference to the parent slide
        /*s.parent = {
            file: nodeData.file,
            name: nodeData.name
        }*/   

        //create the DOM node
        const zone = document.createElement('div');
        zone.id = s.id;
        zone.className = "scrollZone";

        let h = null;
        if( s.h === 'remaining' ){
            h = `${ window.innerHeight - s.y }px`;
        }
        else{
            h = `${ s.h }px`;
        }

        
        zone.setAttribute(
            "style",
            `width: ${ s.w }px;
            height: ${ h };
            top: ${ s.y }px;
            left: ${ s.x }px;`
        );

        //if feature list do something different
        if( s.id === 'featureList' ){

            console.log( 'feature only' );

            //status sort-by also has filters to 
            let filterOptions = [
                {
                    name: 'not-started',
                    value: true
                },
                {
                    name: 'conceptual',
                    value: true
                },
                {
                    name: 'design-in-progress',
                    value: true
                },
                {
                    name: 'design-complete',
                    value: true
                },{
                    name: 'deployed',
                    value: false
                }
            ];
            let activeSort = 'rank';

            //filter the data if needed
            //apply or remove the filter from the array above
            function adjustFilters( filter ){
                let item = filterOptions.find( option => {
                    return option.name === filter;
                });
                item.value = !item.value;
            }


            //sort feature data
            function sortFeatures( key, order='asc' ){
                console.log( 'sorting by:', key );

                if( key === 'alpha' ){
                    key = 'title';
                }

                console.log( order );

                return function(a, b) {
                    if(!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
                        // property doesn't exist on either object
                        return 0;
                    }
                
                    let varA = (typeof a[key] === 'string') ?
                        a[key].toUpperCase() : a[key];
                    let varB = (typeof b[key] === 'string') ?
                        b[key].toUpperCase() : b[key];

                    //if the key value is null then make the value 1 million so it sorts to the end of the list
                    if( a[key] === null ){
                        varA = order === 'desc' ? 0 : 1000000;
                    }
                    if( a[key] === 'Not Scored' ){
                        varA = order === 'desc' ? 1 : 1000000;
                    }
                    if( b[key] === null ){
                        varB = order === 'desc' ? 0 : 1000000;
                    }
                    if( b[key] === 'Not Scored' ){
                        varB = order === 'desc' ? 1 : 1000000;
                    }
                
                    let comparison = 0;
                    if (varA > varB) {
                        comparison = 1;
                    } else if (varA < varB) {
                        comparison = -1;
                    }
                    return (
                        (order == 'desc') ? (comparison * -1) : comparison
                    );
                };
            }
            s.features.sort( sortFeatures( 'rank' ) );

            //generate the html for the feature list
            function generateFeatureHTML(){

                //build the feature HTML
                let features = '';
                for( let f of s.features ){

                    //skip if this item should be filtered out
                    let item = filterOptions.find( option => {
                        return option.name.toLowerCase() === f.status.toLowerCase();
                    });
                    if( item.value === false ){
                        continue;   
                    }

                    
                    features = features + `
                        <div class='feature' data-id="${ f.title }">
                            <div class='feature-image'>
                                <img src="img/${ f.img }" />
                            </div>
                            <div class='feature-info'>
                                <p class='feature-info-title'>${ f.title }</p>
                                ${ f.score !== null ?
                                    `<p class='feature-info-score'>Score: ${ f.score }</p>`
                                :
                                    '' 
                                }
                                <p class='feature-info-description'>${ f.desc }</p>
                                <p class='feature-info-status'>${ f.status }</p>
                            </div>
                            <div class="hotspots"></div>
                        </div>
                    `
                }

                //determine if a filter is active
                function filterActive( filter ){
                    const item = filterOptions.find( option => {
                        return option.name.toLowerCase() === filter.toLowerCase();
                    });
                    return item.value === true ? 'active' : 'disabled';
                }

                //render the scrollZone HTML
                zone.innerHTML = `
                    <div class="scrollZone_inner">
                        <div class="controls">
                            <div class="features_sort">
                                <span>Sort:</span>
                                <div class="features_sort_option" id="rank">
                                    Priority
                                </div>
                                <div class="features_sort_option" id="score">
                                    Score
                                </div>
                                <div class="features_sort_option" id="status">
                                    Status
                                </div>
                                <div class="features_sort_option" id="alpha">
                                    Alphabetically
                                </div>
                            </div>
                            <div class="features_filter">
                                <span>Filter:</span>
                                <div class="features_filter_option ${ filterActive( 'not-started' ) }" id='not-started'>
                                    Not Started
                                </div>
                                <div class="features_filter_option ${ filterActive( 'conceptual' ) }" id='conceptual'>
                                    Conceptual
                                </div>
                                <div class="features_filter_option ${ filterActive( 'design-in-progress' ) }" id='design-in-progress'>
                                    Design In-progress
                                </div>
                                <div class="features_filter_option ${ filterActive( 'design-complete' ) }" id='design-complete'>
                                    Design Complete
                                </div>
                                <div class="features_filter_option ${ filterActive( 'deployed' ) }" id='deployed'>
                                    Deployed
                                </div>
                            </div>
                        </div>
                        <div class="features">
                            ${ features }
                        </div>
                    </div>
                `;

                //find the sort item and make it active
                zone.querySelector( `.features_sort_option#${ activeSort }` ).classList.add( 'active' );

                //add the hotspot for each feature
                for( let f of s.features ){

                    //skip if this item should be filtered out
                    let item = filterOptions.find( option => {
                        return option.name.toLowerCase() === f.status.toLowerCase();
                    });
                    if( item.value === false ){
                        continue;   
                    }

                    if( typeof f.link !== 'undefined' ){
                        let hotspot = _self.hotspot( {
                            name: nodeData.name,
                            file: nodeData.file,
                            type: 'newWindow',
                            x:0,
                            y:0,
                            w: 0,
                            h: 0,
                            link: f.link
                        }, wrap);
                        zone.querySelector( `.feature[data-id='${ f.title }'] .hotspots` ).appendChild( hotspot );
                    }
                }

                 //setup the sorting options
                const options = zone.querySelectorAll( '.features_sort_option' );
                for( let o of options ){
                    o.addEventListener( 'click', () => sortBy( o.getAttribute( 'id' ) ) );
                }
                
                //setup the filtering options
                const filters = zone.querySelectorAll( '.features_filter_option' );
                for( let f of filters ){
                    f.addEventListener( 'click', () => filterBy( f.getAttribute( 'id' ) ) );
                }
                

            }
            generateFeatureHTML( 'rank' );


            /*
                sort the list by
            */
            function sortBy( order ){
                event.stopPropagation();

                //remove the items
                zone.querySelector( '.features' ).innerHTML = '';
                zone.querySelector( '.features_sort_option.active' ).classList.remove( 'active' );

                //reorder data
                const direction = order === 'score' ? 'desc' : 'asc';
                s.features.sort( sortFeatures( order, direction ) );

                //set this item to be active

                //repopulate
                activeSort = order;
                generateFeatureHTML( order );

            }


            /*
                filter by
            */
            function filterBy( filterProp ){
                event.stopPropagation();

                //remove the items
                zone.querySelector( '.features' ).innerHTML = '';

                //update the filters
                adjustFilters( filterProp );

                //repopulate
                generateFeatureHTML();
            }

        }
        
        //for every other regular scrollzone
        else{
            zone.innerHTML = `
                <div class="scrollZone_inner">
                    <div class="scrollZone_inner_fullHeight">
                        <img class="image" src="img/${ s.img }" />
                        <div class="hotspots"></div>
                        <div class="comments"></div>
                    </div>
                </div>
            `;
            if (s.maxImgWidth) {
                zone.querySelector('.image').setAttribute("style", `width: ${ s.maxImgWidth }px`);
            }

            for (let h of s.hotspots) {

                //h.file = nodeData.file;

                //for directly defined hotspots
                if( typeof h !== 'undefined' && h.link !== "" && typeof h.link !== 'undefined' ){
                    //h.name = nodeData.name; //for non-global hotspots we need to define the name of the node the hotspot resides within
                    let newHotspot = _self.hotspot(h, wrap);
                    if( newHotspot !== false ){
                        zone.querySelector('.hotspots').appendChild( newHotspot );
                    }
                    
                } 
                
                //for global hotspots
                else if( h.type === 'global' ){

                    //if global 
                    if( h.state === 'deleted' ){
                        continue;
                    }

                    //check if global hotspot data is loaded
                    //if not defined wait until it is then run
                    if( typeof _self.dataPieces.global === 'undefined' ){
                        _self.appendHotspotsWhenDataIsLoaded(
                            'global',
                            zone,
                            h,
                            wrap
                        );
                    }
                    
                    //if data already loaded then just use it
                    else{
                        const globalH = _self.dataPieces.global[ h.name ];
                        if( typeof globalH === 'undefined '){
                            console.log( 'global hotspot not found', h.name );
                        }
                        
                        else{
                            let hotspot = _self.hotspot(
                                _self.dataPieces.global[ h.name ],
                                wrap,
                                true
                            );
                            if( hotspot !== false ){
                                zone.querySelector('.hotspots').appendChild( hotspot );
                            }
                        }
                    }
                    
                }

                //catch for badly formatted hotspots
                else {
                    console.error('hotspot data not valid');
                }

            };

    
            if (typeof s.comments === "object") {
                if (_self.disableComments !== true) {
                    s.commentsNum = nodeData.commentsNum;
                    for (let c of s.comments) {
                        let comment = this.comment(c, zone, s );
                        if( comment !== false ){
                            zone.querySelector('.comments').appendChild( comment );
                            s.commentsNum++;
                        }
                    };
                }
    
            }
    
            //append layers
            //layers are static elements that overlay the scroll zone but don't scroll with it
            if (typeof s.layers !== "undefined") {
                for (let l of s.layers) {
                    const layer = document.createElement('div');
                    layer.className = "scrollZone_layer";
                    layer.setAttribute(
                        "style",
                        `width: ${ l.w }px;
                        height: ${ l.h }px;
                        top: ${ l.y }px;
                        left: ${ l.x }px;`
                    );
                    layer.innerHTML = `
                        <img class="image" src="img/${ l.img }" />
                        <div class="hotspots"></div>
                    `;
    
                    zone.appendChild(layer);
    
                    if (typeof l.hotspots !== "undefined") {
                        for (let h of l.hotspots) {
                            h.name = nodeData.name;
                            h.file = nodeData.file;

                            let newHotspot = _self.hotspot(h, wrap);
                            if( newHotspot !== false ){
                                layer.querySelector('.hotspots').appendChild( newHotspot );
                            }
                            
                        }
                    }
    
                }
            }

            //fetch the image and get the 
            this.getImageModData( node, s );
        }

        return zone;
    }

    /*
        Get the last modified date of the image for a screen
        Fetch the image, parse the headers to get the last-modified data
        Find the DOMNode where we should render the last-modified date and render it
    */
    this.getImageModData = function( node, data ){

        //if running locally skip this
        if( location.protocol === 'file:' ){
            return false;
        }


        let result = null; 
        let resultData = null;

        fetch( `img/${ data.img }` )
            .then( response => response )
            .then( resp => {

                //headers are an array of arrays.
                //part 1 of the array is the key, part 2 is the value.
                for( let h of resp.headers ){
                    if( h[0] === 'last-modified' ){
                        resultData = new Date( h[1] );
                    }
                }
                
                //if the fetch is successful and we get the last modified date then continue
                if( resultData !== null ){

                    //look at the lastMod DOM Node for this screen and see if we've stored a date in it already
                    //did this because since we are fetching images this was an easy was to not have to syncronize fetch processes
                    let lastModField = node.querySelector( '#lastMod' );
                    let currentDate = lastModField.getAttribute( 'data-date' );
                    if( currentDate !== null ){
                        currentDate = new Date( currentDate );

                        //check if date currently shown is older than new date. 
                        //if older replace it with the new date
                        //we want to show the most recently updated image on the screen.
                        if( resultData < currentDate ){
                            resultData = currentDate;
                        }
                    }

                    //update the DOM Node for this slide with the latest date info.
                    lastModField.innerHTML = _self.humanDate( resultData );
                    lastModField.setAttribute( 'data-date', resultData );
                }
            });

    }



    /*
        create drawer to load slide thumbs into
    */
    this.setupDrawer = (function () {
        _self.drawer = document.querySelector('.slideDrawer');
        _self.drawerContents = _self.drawer.querySelector('.slideDrawer_inner');
        _self.drawerTrigger = _self.drawer.querySelector('.slideDrawer_trigger');


        //toggle the drawer
        _self.drawerTrigger.onclick = function () {
            console.log('toggle drawer');
            _self.drawer.classList.toggle('open');
        }
    })();

    /*
        Setup back and next buttons
    */
    this.setupNav = (function () {
        _self.back = document.querySelector('.slideNav.back');
        _self.next = document.querySelector('.slideNav.next');

        //_self.back.onclick = _self.goBack;
        //_self.next.onclick = _self.showNext;
    })();


    /*
        when clicking on an item in the drawer
    */
    this.drawerItemClick = function () {
        const newItem = this.getAttribute('data-item');
        console.log('item clicked', newItem);

        _self.changeItem(newItem, _self.mainContext)
    }


    /*
        create drawer to load slide thumbs into
    */
    this.fillDrawer = function () {
        console.log( 'populate nav drawer' );

         //Helper function if a bucket name has an underscore replace with a space
         function generateBucketName(name) {
            const regex = /_/gi;
            return name.replace(regex, ' ');
        }




        //loop through data and add to drawer
        for( let d in _self.dataPieces ){

            let file = _self.dataPieces[ d ];

            //make new bucket
            const drawerBucket = document.createElement('div');
            drawerBucket.className = 'slideDrawer_bucket';
            drawerBucket.setAttribute('id', d );
            drawerBucket.innerHTML = `<p class='slideDrawer_bucket_name'>${ generateBucketName( d ) }</p>`

            _self.drawerContents.appendChild( drawerBucket );


            //find items that should be rendered in the drawer
            let bucketCount = 0;
            for( let s in file ){

                let slide = file[ s ];

                //if slide has the show in drawer flag then add it to the drawer
                if( slide.showInDrawer === true ){
                    const drawerItem = document.createElement('div');
                    drawerItem.className = 'slideDrawer_item';
                    drawerItem.setAttribute('data-item', s );
                    drawerItem.innerHTML = `
                        <img src="img/${ slide.img }" />
                        <p>${ slide.drawerInfo.title }</p>
                    `;

                    drawerBucket.appendChild( drawerItem );

                    bucketCount++;

                    drawerItem.onclick = _self.drawerItemClick;
                }
            }

            if( bucketCount === 0 ){
                drawerBucket.remove();
            }


        }

    };




    
    /*
        Create a modal
    */
    this.modal = function( title, content, position = null, id ){
        const node = document.createElement('div');
        node.className = `modal`;
        node.innerHTML = `
            <div class="modal-inner">
                ${ title !== null ? `
                    <div class="modal-header">
                        <p class="modal-header-title">${ title }</p>
                        <span class="closeX">+</span>
                    </div>
                `: ''}
                <div class="modal-content">
                    ${ content }
                </div>
            </div>
        `;

        if( id !== null ){
            node.setAttribute( 'id', id );
        }

        if( title !== null ){
            node.querySelector( '.closeX' ).onclick = closeModal;
        }
        
        if( position !== null ){
            node.setAttribute( 'data-customPosition', true );
            node.querySelector( '.modal-inner' ).setAttribute(
                "style",
                `width: ${ position.w }px;
                height: ${ position.h }px;
                top: ${ position.y }px;
                left: ${ position.x }px;`
            );
        }
        document.querySelector( 'body' ).appendChild( node );

        _self.currentModal = id;

        function closeModal(){
            _self.closeModal( node );
        }
    }

    /*
        Close a modal
    */
    this.closeModal = function( node ){
        node.remove();
            _self.currentModal = null;
    }

    /*
        Confirmation modal
        Currently using the browser confirmation modal.
    */
    this.confirmation = function( message, callback ){
        const outcome = confirm( message );
        if( typeof callback !== 'function' ){
            console.warn( 'callback is not a function, cannot continue' );
            return false;
        }
        if( outcome == true ){
            callback( true );
        } else {
            callback( false )
        }
    }


    /*
        Toast message
    */
    this.toast = function( message, state ){
        const node = document.createElement('div');
        node.className = `toast`;
        node.setAttribute( 'data-state', state );
        node.innerHTML = `
            ${ state === 'error' ? `
                <svg class='icon' xmlns='http://www.w3.org/2000/svg' version='1.1' width='40px' height='40px' viewBox='0 0 40 40'><path d='M20,8 C13.376,8 8,13.376 8,20 C8,26.624 13.376,32 20,32 C26.624,32 32,26.624 32,20 C32,13.376 26.624,8 20,8 Z'></path><path d='M20,21.2 L20,21.2 C19.34,21.2 18.8,20.66 18.8,20 L18.8,15.2 C18.8,14.54 19.34,14 20,14 L20,14 C20.66,14 21.2,14.54 21.2,15.2 L21.2,20 C21.2,20.66 20.66,21.2 20,21.2 Z' fill='#FFFFFF' fill-rule='nonzero'></path><polygon fill='#FFFFFF' fill-rule='nonzero' points='21.2 26 18.8 26 18.8 23.6 21.2 23.6'></polygon></svg>
            `: ''}
            <div class="toast-inner">
                ${ state !== 'info' ? state + ':' : '' }${ message }
                <span class="closeX">+</span>
            </div>
        `;
        document.querySelector( 'body' ).appendChild( node );

        node.querySelector( '.closeX' ).onclick = removeToast;

        setTimeout( removeToast, 5000 );
        
        function removeToast(){
            node.classList.add( 'transitionOut' );
            setTimeout( () => {
                node.remove();
            }, 300 );
        }
    }
    


    



    /*
        Setup Mode
        Figure out which mode we should be in an act accordingly
        Check localStorage for cached mode
    */
    this.setupMode = function(){
        const storedMode = _self.local( 'get', 'mode' );
        const storedUser = _self.local( 'get', 'user' );
        let mode = _self.mode;

        if( storedMode !== null ){
            mode = storedMode;
        }

        if( storedUser !== null ){
            _self.activeUser = storedUser;
        }

        if( mode === 'build' ){
            _self.enableBuildMode();
        }else{
            _self.enableViewMode();
        }
    }

     /*
        Build Mode
        Edit / create hotspots etc
    */
    this.enableBuildMode = function(){

        //find the user, check if they are able to access build mode
        let userData = _self.findUser( _self.activeUser );
        if( typeof userData === 'undefined' ){
            //console.log( "can't find active user", _self.activeUser );
            return false;
        }

        //see if the user has build access
        if( userData.access !== 'build' ){
            //console.log( 'User does not have access to "Build" mode' );
            return false;
        }

        //User does have build access - now check if user has authenticated before or not
        //if not authenticated launch the modal to sign in.
        //this prevents users getting around the auth by entering the name/company of a user who has build access when adding a new comment
        let authStatus = _self.local( 'get', 'userAuth' );
        if( authStatus === null || authStatus === false ){
            //console.log( "User does have access to build mode but hasn't signed in yet" );
            _self.authModal();
            return false;
        }

        console.log( 'enable build mode', userData, authStatus );
        _self.mode = 'build';

        _self.local( 'set', 'mode', _self.mode );

        document.querySelector( 'body' ).setAttribute( 'data-mode', 'build' );

        //determine which control icons to reveal for this mode, add each to the controls node
        let controls = [ 'addAnnotation', 'addHotspot', 'toggleBuildMode', 'addToDrawer', 'overflow' ];

        //loop through the controls array and add each option to the control box.
        _self.modeControls.innerHTML = null;
        for( let c of controls ){
            _self.modeControls.appendChild( _self.addModeControl( c ) );
        }
        _self.modeControls.querySelector( '#toggleBuildMode' ).classList.add( 'active' );
    }

    /*
        Build Mode
        Edit / create hotspots etc
    */
    this.enableViewMode = function(){
        console.log( 'enable view/comment mode' );
        _self.mode = 'view';

        _self.local( 'set', 'mode', _self.mode );

        document.querySelector( 'body' ).setAttribute( 'data-mode', 'view');

        //determine which control icons to reveal for this mode, add each to the controls node - for view mode we start with only the add comment
        let controls = [ 'addComment', 'overflow' ];
        let ableToAcessBuildMode = false;

        //if there is an active user already then see if that user can access build mode or not, if yes add the build mode toggle to the controls array above before iterating below
        if( _self.activeUser !== null ){
            let user = _self.findUser( _self.activeUser );

            if( typeof user !== 'undefined' ){
                if( user.access === 'build' ){
                    controls.splice(1, 0, 'toggleBuildMode' ); //add the build toggle to the controls in the 2nd position
                    ableToAcessBuildMode = true;
                }
            }
        }
        //if we don't know the active user still show the build control toggle so we can access the login 
        else{
            controls.push( 'toggleBuildMode' );
            ableToAcessBuildMode = true;
        }
        
        //loop through the controls array and add each option to the control box.
        _self.modeControls.innerHTML = null;
        for( let c of controls ){
            _self.modeControls.appendChild( _self.addModeControl( c ) );
        }

        if( ableToAcessBuildMode === true ){
            _self.modeControls.querySelector( '#toggleBuildMode' ).classList.remove( 'active' );
        }
        
    }

    /*
        Add a mode control
    */
    this.addModeControl = function( control ){

        let icon = null;
        switch( control ){
            case 'addComment':
                icon = `
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <title>icon_comment</title>
                        <g fill-rule="evenodd">
                            <path d="M23,10 L23,12 L12,12 L12,24 L26.83,24 L28,25.17 L28,17 L30,17 L30,30 L26,26 L12,26 C10.95,26 10.0822314,25.1799587 10.0055128,24.1486946 L10,24 L10,12 C10,10.95 10.8200413,10.0822314 11.8513054,10.0055128 L12,10 L23,10 Z M25,19 L25,21 L15,21 L15,19 L25,19 Z M25,15 L25,17 L15,17 L15,15 L25,15 Z M30,7 L30,10 L33,10 L33,12 L30,12 L30,14.99 C30,14.99 28.01,15 28,14.99 L28,14.99 L28,12 L25,12 C25,12 25.01,10.01 25,10 L25,10 L28,10 L28,7 L30,7 Z"  fill-rule="nonzero"></path>
                        </g>
                    </svg>
                `
                break;
            case 'addAnnotation':
                icon = `
                        <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                            <title>icon_annotation</title>
                            <g fill-rule="evenodd">
                                <path d="M21,12 L21,14 L14,14 L14,26.22 L26,26.22 L26,19 L28,19 L28,26 C28,27.1 27.1,28 26,28 L26,28 L14,28 C12.9,28 12,27.1 12,26 L12,26 L12,14 C12,12.9 12.9,12 14,12 L14,12 L21,12 Z M24,22 L24,24 L16,24 L16,22 L24,22 Z M24,19 L24,21 L16,21 L16,19 L24,19 Z M24,16 L24,18 L16,18 L16,16 L24,16 Z M28,9 L28,12 L31,12 L31,14 L28,14 L28,16.99 C28,16.99 26.01,17 26,16.99 L26,16.99 L26,14 L23,14 C23,14 23.01,12.01 23,12 L23,12 L26,12 L26,9 L28,9 Z" fill-rule="nonzero"></path>
                            </g>
                        </svg>
                `;
                break;
            case 'addHotspot':
                icon = `
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <title>icon_hotspot</title>
                        <g fill-rule="evenodd">
                            <path d="M27.8176936,23.0850428 L33.1504175,27.656009 C33.3655175,27.8306807 33.2067987,28.1425868 32.9160425,28.1425868 L30.926968,28.1425868 L31.973799,30.2674762 C32.0467177,30.4147887 31.9633927,30.5799604 31.796724,30.6424604 L30.8748805,30.9772571 C30.7030368,31.0397571 30.5103243,30.9683352 30.4374056,30.8254759 L29.442662,28.8077271 L27.8177124,30.2005075 C27.6011687,30.3860855 27.25,30.2430231 27.25,29.9996326 L27.25,23.2859177 C27.25,23.0296678 27.6235187,22.904746 27.8176936,23.0850428 Z M31,10 L31,24 L29,22 L29,12 L13,12 L13,24 L26,24 L26,26 L11,26 L11,10 L31,10 Z" fill-rule="nonzero"></path>
                        </g>
                    </svg>
                `
                break;
            case 'addToDrawer':
                icon = `
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <title>icon_addToDrawer</title>
                        <g fill-rule="evenodd">
                        <path d="M29,10 L11,10 C9.89,10 9,10.9 9,12 L9,26 C9,27.1 9.89,28 11,28 L17,28 L17,26 L11,26 L11,16 L29,16 L29,26 L23,26 L23,28 L29,28 C30.1,28 31,27.1 31,26 L31,12 C31,10.9 30.11,10 29,10 Z M19.2928932,18.7071068 L16.8535534,21.1464466 C16.6582912,21.3417088 16.6582912,21.6582912 16.8535534,21.8535534 C16.9473216,21.9473216 17.0744985,22 17.2071068,22 L19,22 L19,22 L19,27 C19,27.5522847 19.4477153,28 20,28 C20.5522847,28 21,27.5522847 21,27 L21,22 L21,22 L22.7928932,22 C23.0690356,22 23.2928932,21.7761424 23.2928932,21.5 C23.2928932,21.3673918 23.2402148,21.2402148 23.1464466,21.1464466 L20.7071068,18.7071068 C20.3165825,18.3165825 19.6834175,18.3165825 19.2928932,18.7071068 Z" fill-rule="nonzero" transform="translate(20.000000, 19.000000) rotate(-180.000000) translate(-20.000000, -19.000000) "></path>
                        </g>
                    </svg>
                `
                break;
            case 'toggleBuildMode':
                icon = `
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <title>icon_mode-build</title>
                        <g fill-rule="evenodd">
                            <path d="M30.7,27 L21.6,17.9 C22.5,15.6 22,12.9 20.1,11 C18.1,9 15.1,8.6 12.7,9.7 L17,14 L14,17 L9.6,12.7 C8.4,15.1 8.9,18.1 10.9,20.1 C12.8,22 15.5,22.5 17.8,21.6 L26.9,30.7 C27.3,31.1 27.9,31.1 28.3,30.7 L30.6,28.4 C31.1,28 31.1,27.3 30.7,27 Z" fill-rule="nonzero"></path>
                        </g>
                    </svg>
                `
                break;
            case 'overflow':
                icon = `
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <title>icon_info</title>
                        <g fill-rule="evenodd">
                            <path d="M14,18 C12.9,18 12,18.9 12,20 C12,21.1 12.9,22 14,22 C15.1,22 16,21.1 16,20 C16,18.9 15.1,18 14,18 Z M26,18 C24.9,18 24,18.9 24,20 C24,21.1 24.9,22 26,22 C27.1,22 28,21.1 28,20 C28,18.9 27.1,18 26,18 Z M20,18 C18.9,18 18,18.9 18,20 C18,21.1 18.9,22 20,22 C21.1,22 22,21.1 22,20 C22,18.9 21.1,18 20,18 Z" fill-rule="nonzero"></path>
                        </g>
                    </svg>
                `
                break;
            default:
                break;
        }


        const node = document.createElement('div');
        node.id = control;
        node.className = `modeControls-control`;
        node.innerHTML = `
            <span class="label">${ control }</span>
            ${ icon }
        `;
        node.onclick = _self[ `modeControlHandler_${ control }` ]
        return node;
    }

    /*
        Mode control click handlers
    */
    this.modeControlHandler_addAnnotation = function(){
        console.log( 'toggle annotation add mode' );

        //if already adding an annotation then quit
        if( _self.addingAnnotation === true ){
            _self.removeCommentMode( 'addingAnnotation', '#addAnnotation' );
        }

        //turn on adding annotation mode
        else{
            _self.setupCommentMode( 'addingAnnotation', '#addAnnotation' );
        }
    }
    this.modeControlHandler_addComment = function(){
        console.log( 'add a comment' );

        //check if we know who the active user is
        //if not ask for their name
        if( _self.activeUser === null ){

            if( _self.currentModal === 'newUser' ){
                return false;
            }

            //select user, enter password
            //enter a password to access build mode
            _self.modal(
                'Provide some information about you',
                `<div class="modal-input">
                    <label>First Name</label>
                    <input id="first_name" name="first_name" type="text" value="" placeholder="John" />
                </div>
                <div class="modal-input">
                    <label>Last Name</label>
                    <input id="last_name" name="last_name" type="text" value="" placeholder="Smith" />
                </div>
                <div class="modal-input">
                    <label>Company</label>
                    <select id="company">
                        <option value="start">Please select your company</option>
                        <option value="Cadre5">Cadre5</option>
                        <option value="CNS">CNS</option>
                        <option value="NPO">NPO</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="actions">
                    <button
                        id="addNonBuildUser"
                        class="button"
                    >Submit</button>
                </div>`,
                null,
                'newUser'
            );

            //focus the first field
            document.querySelector( '.modal #first_name' ).focus();

            //listen for enter press
            _self.listenForEnter( document.querySelector( '.modal' ), _self.addUser );

            //check the user and provided pass against the DB pass.
            document.querySelector( '.modal #addNonBuildUser' ).onclick = _self.addUser;

        }

        //if the active user is already set.
        else{

            //if already adding an comment then quit
            if( _self.addingComment === true ){
                _self.removeCommentMode( 'addingComment', '#addComment' );
            }

            //turn on adding annotation mode
            else{
                _self.setupCommentMode( 'addingComment', '#addComment' );
            }
        }

    }
    this.modeControlHandler_addHotspot = function(){
        console.log( 'add a hotspot' );

        //if already adding an comment then quit
        if( _self.addingHotspot === true ){
            _self.removeCommentMode( 'addingHotspot', '#addHotspot' );
        }

        //show modal to ask which type of hotspot to add
        //turn on adding hotspot mode
        else{

            if( _self.currentModal === 'addHotspot' ){
                return false;
            }

            //show the modal for adding to drawer
            //build the modal
            let modalContent = `
                <div class="newHotspotOptions">
                    <div id="new" class="modal-input">
                        <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                            <g fill-rule="evenodd">
                                <path d="M21,15 L19,15 L19,19 L15,19 L15,21 L19,21 L19,25 L21,25 L21,21 L25,21 L25,19 L21,19 L21,15 Z M20,10 C14.48,10 10,14.48 10,20 C10,25.52 14.48,30 20,30 C25.52,30 30,25.52 30,20 C30,14.48 25.52,10 20,10 Z M20,28 C15.59,28 12,24.41 12,20 C12,15.59 15.59,12 20,12 C24.41,12 28,15.59 28,20 C28,24.41 24.41,28 20,28 Z" fill-rule="nonzero"></path>
                            </g>
                        </svg>
                        <span>Unique Hotspot</span>
                    </div>
                    <div id="global" class="modal-input">
                        <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                            <g fill-rule="evenodd">
                                <path d="M19.99,10 C14.47,10 10,14.48 10,20 C10,25.52 14.47,30 19.99,30 C25.52,30 30,25.52 30,20 C30,14.48 25.52,10 19.99,10 Z M26.92,16 L23.97,16 C23.65,14.75 23.19,13.55 22.59,12.44 C24.43,13.07 25.96,14.35 26.92,16 Z M20,12.04 C20.83,13.24 21.48,14.57 21.91,16 L18.09,16 C18.52,14.57 19.17,13.24 20,12.04 Z M12.26,22 C12.1,21.36 12,20.69 12,20 C12,19.31 12.1,18.64 12.26,18 L15.64,18 C15.56,18.66 15.5,19.32 15.5,20 C15.5,20.68 15.56,21.34 15.64,22 L12.26,22 Z M13.08,24 L16.03,24 C16.35,25.25 16.81,26.45 17.41,27.56 C15.57,26.93 14.04,25.66 13.08,24 L13.08,24 Z M16.03,16 L13.08,16 C14.04,14.34 15.57,13.07 17.41,12.44 C16.81,13.55 16.35,14.75 16.03,16 L16.03,16 Z M20,27.96 C19.17,26.76 18.52,25.43 18.09,24 L21.91,24 C21.48,25.43 20.83,26.76 20,27.96 Z M22.34,22 L17.66,22 C17.57,21.34 17.5,20.68 17.5,20 C17.5,19.32 17.57,18.65 17.66,18 L22.34,18 C22.43,18.65 22.5,19.32 22.5,20 C22.5,20.68 22.43,21.34 22.34,22 Z M22.59,27.56 C23.19,26.45 23.65,25.25 23.97,24 L26.92,24 C25.96,25.65 24.43,26.93 22.59,27.56 L22.59,27.56 Z M24.36,22 C24.44,21.34 24.5,20.68 24.5,20 C24.5,19.32 24.44,18.66 24.36,18 L27.74,18 C27.9,18.64 28,19.31 28,20 C28,20.69 27.9,21.36 27.74,22 L24.36,22 Z" fill-rule="nonzero"></path>
                            </g>
                        </svg>
                        <span>Global Hotspot</span>
                    </div>
                </div>
            `;

            //calculate where to display the modal relative to the hotspot clicked
            const modalW = 400;
            const modalH = 117;
            let x = event.clientX;
            if( ( x + modalW ) > window.innerWidth ){
                x = x - modalW < 0 ? 10 : x - modalW;
            }
            let y = event.clientY;
            if( ( y + modalH ) > window.innerHeight ){
                y = y - modalH < 0 ? 10 : y - modalH;
            }

            _self.modal(
                null,
                modalContent,
                {
                    w: modalW,
                    h: modalH,
                    x: x,
                    y: y
                },
                'addHotspot'
            );

            document.querySelector( '.modal #new' ).onclick = function(){
                event.stopPropagation();
                _self.setupCommentMode( 'addingHotspot', '#addHotspot' );

                _self.closeModal( document.querySelector( '.modal#addHotspot' ) );
            }

            document.querySelector( '.modal #global' ).onclick = function(){
                event.stopPropagation();

                //remove the current modal
                _self.closeModal( document.querySelector( '.modal#addHotspot' ) );

                //launch a modal to browse all global hotspots
                let globalHotspots = '';
                for( let g in _self.dataPieces.global ){
                    const hotspot = _self.dataPieces.global[ g ];
                    globalHotspots = globalHotspots + `
                        <div id="${ hotspot.name }" class="globalHotspotList-item">
                            <div class="globalHotspotList-item-overview">
                                <span class="globalHotspotList-item-name">${ hotspot.name }</span>
                                <span class="globalHotspotList-item-link">Link to: ${ hotspot.link }</span>
                            </div>
                            <button
                                class="hotspotDetails button button--icon destructive"
                            >
                                <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                                    <path d="M14,18 C12.9,18 12,18.9 12,20 C12,21.1 12.9,22 14,22 C15.1,22 16,21.1 16,20 C16,18.9 15.1,18 14,18 Z M26,18 C24.9,18 24,18.9 24,20 C24,21.1 24.9,22 26,22 C27.1,22 28,21.1 28,20 C28,18.9 27.1,18 26,18 Z M20,18 C18.9,18 18,18.9 18,20 C18,21.1 18.9,22 20,22 C21.1,22 22,21.1 22,20 C22,18.9 21.1,18 20,18 Z" fill-rule="nonzero"></path>
                                </svg>
                            </button>
                        </div>
                    `;
                }
                _self.modal(
                    'Browse Global Hotspots',
                    `<div class="globalHotspotList">
                        ${ globalHotspots }
                    </div>`,
                    null,
                    'browseGlobalHotspots'
                );

                let hotspotOptions = document.querySelectorAll( '.globalHotspotList-item' );
                for( let o of hotspotOptions ){
                    o.onclick = function(){
                        const id = o.getAttribute( 'id' );
                        console.log( 'selected global hotspot option:', id );

                        //user would need to select where to put the hotspot, might fall within a scrollZone etc.
                        _self.setupCommentMode( 'addingGlobalHotspot', '#addHotspot' );
                        _self.newGlobalHotspotData = _self.dataPieces.global[ id ];

                        _self.closeModal( document.querySelector( '.modal#browseGlobalHotspots' ) );
                        
                    }

                    o.querySelector( '.hotspotDetails' ).onclick = function(){
                        event.stopPropagation();
                        const id = o.getAttribute( 'id' );

                        //find the hotspot data
                        const hotspotData = _self.dataPieces.global[ id ];
                        
                        //show it in a modal
                        const modalW = 300;
                        const modalH = 257;
                        let x = event.clientX;
                        if( ( x + modalW ) > window.innerWidth ){
                            x = x - modalW < 0 ? 10 : x - modalW;
                        }
                        let y = event.clientY;
                        if( ( y + modalH ) > window.innerHeight ){
                            y = y - modalH < 0 ? 10 : y - modalH;
                        }

                        if( _self.currentModal === 'globalHotspotDetails' ){
                            return false;
                        }

                        _self.modal(
                            'hotspot details',
                            `
                                <p class='globalHotspotList-item--details'>id: ${ hotspotData.id }</p>
                                <p class='globalHotspotList-item--details'>type: ${ hotspotData.type }</p>
                                <p class='globalHotspotList-item--details'>left: ${ hotspotData.x }px</p>
                                <p class='globalHotspotList-item--details'>top: ${ hotspotData.y }px</p>
                                <p class='globalHotspotList-item--details'>width: ${ hotspotData.w }px</p>
                                <p class='globalHotspotList-item--details'>height: ${ hotspotData.h }px</p>
                                <p class='globalHotspotList-item--details'>link: ${ hotspotData.link }</p>
                            `,
                            {
                                w: modalW,
                                h: modalH,
                                x: x,
                                y: y
                            },
                            'globalHotspotDetails'
                        );
                    }
                }
    
                
            }

        }
    }
    this.modeControlHandler_addToDrawer = function(){
        console.log( 'add this slide to drawer' );

        //check if slide is already in the drawer
        if( _self.activeSlide.showInDrawer === true ){
            _self.confirmation(
                'Are you sure you want to remove this slide from the drawer?',
                ( result ) => {
                    if( result === true ){

                        _self.activeSlide.showInDrawer = false;

                        _self.post(
                            'update/slide',
                            _self.activeSlide,
                            function( data ){
                                if( data.status === 'error' ){
                                    _self.toast( 'removing slide from the drawer failed!', 'error' );
                                }else{
                                    _self.toast( 'slide successfully remove from the drawer!', 'success' );
                                }  
                            }
                        );
                    }
                }
            );
        }
        
        //if not already in drawer
        else {
            //show the modal for adding to drawer
            //build the modal
            let modalContent = `
            <div class="modal-input">
                <label>Drawer Label</label>
                <input id="drawerLabel" name="drawerLabel" value="${ typeof _self.activeSlide.drawerInfo !== 'undefined' ? _self.activeSlide.drawerInfo.title : '' }" placeholder='Enter a label for this slide' />
            </div>
            <div class="actions">
                <button
                    id="updateSlide"
                    class="button"
                >Add Slide to Drawer</button>
            </div>
            `;

            //calculate where to display the modal relative to the hotspot clicked
            const modalW = 400;
            const modalH = 235;
            let x = event.clientX;
            if( ( x + modalW ) > window.innerWidth ){
                x = x - modalW < 0 ? 10 : x - modalW;
            }
            let y = event.clientY;
            if( ( y + modalH ) > window.innerHeight ){
                y = y - modalH < 0 ? 10 : y - modalH;
            }

            _self.modal(
                'Add Slide to Drawer',
                modalContent,
                {
                    w: modalW,
                    h: modalH,
                    x: x,
                    y: y
                },
                'addToDrawer'
            );

            document.querySelector( '.modal #updateSlide' ).onclick = function(){
                event.stopPropagation();

                if( document.querySelector( '.modal #drawerLabel' ).value === '' ){
                    _self.toast( 'Label field is empty, please enter a label to describe this slide to other users', 'error' );
                }

                else{
                    _self.activeSlide.showInDrawer = true;
                    _self.activeSlide.drawerInfo = {
                        title: document.querySelector( '.modal #drawerLabel' ).value
                        //don't need to worry about group - it's the file so app.js will handle it.
                    }

                    _self.post(
                        'update/slide',
                        _self.activeSlide,
                        function( data ){
                            if( data.status === 'error' ){
                                _self.toast( 'adding slide to the drawer failed!', 'error' );
                            }else{
                                _self.toast( 'slide successfully added from the drawer!', 'success' );

                                _self.closeModal( document.querySelector( '.modal#addToDrawer' ) );
                            }  
                        }
                    );
                }
                
    
            }

        }
    }
    this.modeControlHandler_toggleBuildMode = function(){
        if( _self.mode !== 'build' ){

            //has the user previously authenticated successfully?
            const returningUser = _self.local( 'get', 'user', 'returning' );
            if( returningUser !== null ){
                console.log( 'returning user', returningUser );

                //find the user, check if they are able to access build mode
                let userData = _self.findUser( returningUser );
                if( typeof userData === 'undefined' ){
                    return false;
                }
                if( userData.access !== 'build' ){
                    _self.toast( 'You do not have access to "Build" mode. Contact Cadre5 to request access.', 'error' );
                    return false;
                }

                //if made it to here user can access build mode, so enable it
                _self.enableBuildMode();
            }

            //not a returning user so make them auth
            else{
                _self.authModal();
            }

        }
        else{
            _self.enableViewMode();
        }
    }


    /*
        Overflow menu in the actions bar
    */
    this.modeControlHandler_overflow = function(){

        if( _self.currentModal === 'overflow' ){
            return false;
        }

        let modalContent = `
            <div id="info" class="overflow_item">
                <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                    <path d="M19,15 L21,15 L21,17 L19,17 L19,15 Z M19,19 L21,19 L21,25 L19,25 L19,19 Z M20,10 C14.48,10 10,14.48 10,20 C10,25.52 14.48,30 20,30 C25.52,30 30,25.52 30,20 C30,14.48 25.52,10 20,10 Z M20,28 C15.59,28 12,24.41 12,20 C12,15.59 15.59,12 20,12 C24.41,12 28,15.59 28,20 C28,24.41 24.41,28 20,28 Z" fill-rule="nonzero"></path>
                </svg>
                Information / Legend
            </div>
            ${ _self.commentsVisible === true ? `
                <div id="hideComments" class="overflow_item">
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <path d="M20,14.6325 C22.76,14.6325 25,16.8725 25,19.6325 C25,20.1425 24.9,20.6325 24.76,21.0925 L27.82,24.1525 C29.21,22.9225 30.31,21.3825 31,19.6225 C29.27,15.2425 25,12.1325 20,12.1325 C18.73,12.1325 17.51,12.3325 16.36,12.7025 L18.53,14.8725 C19,14.7325 19.49,14.6325 20,14.6325 Z M10.71,11.2925 C10.32,11.6825 10.32,12.3125 10.71,12.7025 L12.68,14.6725 C11.06,15.9625 9.77,17.6625 9,19.6325 C10.73,24.0225 15,27.1325 20,27.1325 C21.52,27.1325 22.97,26.8325 24.31,26.3125 L27.03,29.0325 C27.42,29.4225 28.05,29.4225 28.44,29.0325 C28.83,28.6425 28.83,28.0125 28.44,27.6225 L12.13,11.2925 C11.74,10.9025 11.1,10.9025 10.71,11.2925 Z M20,24.6325 C17.24,24.6325 15,22.3925 15,19.6325 C15,18.8625 15.18,18.1325 15.49,17.4925 L17.06,19.0625 C17.03,19.2425 17,19.4325 17,19.6325 C17,21.2925 18.34,22.6325 20,22.6325 C20.2,22.6325 20.38,22.6025 20.57,22.5625 L22.14,24.1325 C21.49,24.4525 20.77,24.6325 20,24.6325 Z M22.97,19.3025 C22.82,17.9025 21.72,16.8125 20.33,16.6625 L22.97,19.3025 Z" fill-rule="nonzero"></path>
                    </svg>
                    Hide Comments
                </div>
            ` : `
                <div id="showComments" class="overflow_item">
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <path d="M20,12 C15,12 10.73,15.11 9,19.5 C10.73,23.89 15,27 20,27 C25,27 29.27,23.89 31,19.5 C29.27,15.11 25,12 20,12 Z M20,24.5 C17.24,24.5 15,22.26 15,19.5 C15,16.74 17.24,14.5 20,14.5 C22.76,14.5 25,16.74 25,19.5 C25,22.26 22.76,24.5 20,24.5 Z M20,16.5 C18.34,16.5 17,17.84 17,19.5 C17,21.16 18.34,22.5 20,22.5 C21.66,22.5 23,21.16 23,19.5 C23,17.84 21.66,16.5 20,16.5 Z" fill-rule="nonzero"></path>
                    </svg>
                    Show Comments
                </div>
            ` }
            ${ _self.annotationsVisible === true ? `
                <div id="hideAnnotations" class="overflow_item">
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <path d="M20,14.6325 C22.76,14.6325 25,16.8725 25,19.6325 C25,20.1425 24.9,20.6325 24.76,21.0925 L27.82,24.1525 C29.21,22.9225 30.31,21.3825 31,19.6225 C29.27,15.2425 25,12.1325 20,12.1325 C18.73,12.1325 17.51,12.3325 16.36,12.7025 L18.53,14.8725 C19,14.7325 19.49,14.6325 20,14.6325 Z M10.71,11.2925 C10.32,11.6825 10.32,12.3125 10.71,12.7025 L12.68,14.6725 C11.06,15.9625 9.77,17.6625 9,19.6325 C10.73,24.0225 15,27.1325 20,27.1325 C21.52,27.1325 22.97,26.8325 24.31,26.3125 L27.03,29.0325 C27.42,29.4225 28.05,29.4225 28.44,29.0325 C28.83,28.6425 28.83,28.0125 28.44,27.6225 L12.13,11.2925 C11.74,10.9025 11.1,10.9025 10.71,11.2925 Z M20,24.6325 C17.24,24.6325 15,22.3925 15,19.6325 C15,18.8625 15.18,18.1325 15.49,17.4925 L17.06,19.0625 C17.03,19.2425 17,19.4325 17,19.6325 C17,21.2925 18.34,22.6325 20,22.6325 C20.2,22.6325 20.38,22.6025 20.57,22.5625 L22.14,24.1325 C21.49,24.4525 20.77,24.6325 20,24.6325 Z M22.97,19.3025 C22.82,17.9025 21.72,16.8125 20.33,16.6625 L22.97,19.3025 Z" fill-rule="nonzero"></path>
                    </svg>
                    Hide Annotations
                </div>
            ` : `
                <div id="showAnnotations" class="overflow_item">
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <path d="M20,12 C15,12 10.73,15.11 9,19.5 C10.73,23.89 15,27 20,27 C25,27 29.27,23.89 31,19.5 C29.27,15.11 25,12 20,12 Z M20,24.5 C17.24,24.5 15,22.26 15,19.5 C15,16.74 17.24,14.5 20,14.5 C22.76,14.5 25,16.74 25,19.5 C25,22.26 22.76,24.5 20,24.5 Z M20,16.5 C18.34,16.5 17,17.84 17,19.5 C17,21.16 18.34,22.5 20,22.5 C21.66,22.5 23,21.16 23,19.5 C23,17.84 21.66,16.5 20,16.5 Z" fill-rule="nonzero"></path>
                    </svg>
                    Show Annotations
                </div>
            ` }
        `

        //calculate where to display the modal relative to the hotspot clicked
        const modalW = 250;
        const modalH = 152;
        let x = event.clientX;
        if( ( x + modalW ) > window.innerWidth ){
            x = x - modalW < 0 ? 10 : x - modalW;
        }
        let y = event.clientY;
        if( ( y + modalH ) > window.innerHeight ){
            y = y - modalH < 0 ? 10 : y - modalH;
        }

        _self.modal(
            null,
            modalContent,
            {
                w: modalW,
                h: modalH,
                x: x,
                y: y
            },
            'overflow'
        );

        let options = document.querySelectorAll( '.modal .overflow_item' );
        for( let o of options ){
            o.addEventListener( 'click', function(){
                const action = o.getAttribute( 'id' );

                //hide the overflow menu modal
                _self.closeModal( document.querySelector( '.modal#overflow' ) );

                //show the info modal
                if( action === 'info' ){

                    if( _self.currentModal === 'information' ){
                        return false;
                    }

                    _self.modal(
                        'Information about this tool.',
                        `
                            <div class="info">
                                <p class="headerText">Introduction</p>
                                <p class="bodyText">This tool is intended to provide users with a complete walkthrough of what the final software experience will be like. It is comprised of static images (jpgs) with invisible hotspots that let users navigate through the application as if it was real software.</p>
                                <p class="headerText">Annotations</p>
                                <p class="bodyText">Annotations are verified and vetted business rules that should be considered as requirements for the application.</p>
                                <p class="bodyText bold">There are two types of annotations:</p>
                                <p class="bodyText">
                                    <span class="flex flex--vertical-center">
                                        <span class="comment" data-type="logic"></span>
                                        <span><b>Logic:</b> Brown colored comments indicate logic that needs to be built into the applications</span>
                                    </span>
                                </p>
                                <p class="bodyText">
                                    <span class="flex flex--vertical-center">
                                        <span class="comment" data-type="notification"></span>
                                        <span><b>Notification:</b> Green colored comments indicate a notification that will be needed. Details about the notification recipents and content may be included in the annotation or linked to an Issue in Gitlab</span>
                                    </span>
                                </p>
                                <p class="headerText">Comments</p>
                                <p class="bodyText">Comments can be made by any user. They're intended for people to ask questions or post notes about something that isn't consider an official requirement.</p>
                                <p class="bodyText bold">There are two types of comments:</p>
                                <p class="bodyText">
                                    <span class="flex flex--vertical-center">
                                        <span class="comment" data-type="comment"></span>
                                        <span><b>Note:</b> Pink color comments are notes left by any user. They should not be considered as a requirement. They will each be evaluated and dispositioned.</span>
                                    </span>
                                </p>
                                <p class="bodyText">
                                    <span class="flex flex--vertical-center">
                                        <span class="comment" data-type="question"></span>
                                        <span><b>Questions:</b> Gray colored comments are questions that can be let by any user. Currently there is no notification method for informing users about a new question.</span>
                                    </span>
                                </p>
                                <p class="headerText">Status</p>
                                <p class="bodyText">Each screen has a status represented by a circle in the bottom right corner. The color of the circle is an indication about the level of completeness of a screen.</p>
                                <p class="bodyText bold">There are two four statuses:</p>
                                <p class="bodyText">
                                    <span class="flex flex--vertical-center">
                                        <span id="approved" class="status"></span>
                                        <span><b>Stakeholder Approved:</b> This screen has been viewed and vetted by stakeholders as being ready to build.</span>
                                    </span>
                                </p>
                                <p class="bodyText">
                                    <span class="flex flex--vertical-center">
                                        <span id="inProgress" class="status"></span>
                                        <span><b>In Progress:</b> This screen is still evolving but it has been reviewed internally or by stakeholders and is considered fairly stable.</span>
                                    </span>
                                </p>
                                <p class="bodyText">
                                    <span class="flex flex--vertical-center">
                                        <span id="conceptual" class="status"></span>
                                        <span><b>Conceptual:</b> This screen is a design concept. It is in the early phases of design and should be considered unstable and highly likely to change.</span>
                                    </span>
                                </p>
                                <p class="bodyText">
                                    <span class="flex flex--vertical-center">
                                        <span id="onHold" class="status"></span>
                                        <span><b>On Hold:</b> This screen is may be approved or conceptual, but for now it is on hold. It may be part of a future release but it not intended to be developed now.</span>
                                    </span>
                                </p>
                            </div>
                        `,
                        null,
                        'information'
                    );
                }

                //hide comments
                if( action === 'hideComments' ){
                    _self.commentsVisible = false;
                    _self.wrap.classList.add( 'hideComments' );

                    let count = 1;
                    if( _self.annotationsVisible === false ){
                        count++;
                    }
                    _self.modeControls.querySelector( '#overflow' ).setAttribute( 'data-count', count )
                }

                //show comments
                if( action === 'showComments' ){
                    _self.commentsVisible = true;
                    _self.wrap.classList.remove( 'hideComments' );
                }

                //hide annotations
                if( action === 'hideAnnotations' ){
                    _self.annotationsVisible = false;
                    _self.wrap.classList.add( 'hideAnnotations' );
                }

                //show comments
                if( action === 'showAnnotations' ){
                    _self.annotationsVisible = true;
                    _self.wrap.classList.remove( 'hideAnnotations' );
                }
            });
        }


    }


    /*
        Modal to request auth for access to build mode
    */
   this.authModal = function(){
        //load the list of users who can access build mode.
        _self.get( 'users', ( users ) => {
            console.log( users );

            _self.users = users;

            let userOptions = null;
            for( let u of users ){
                if( u.access !== 'build' ){
                    continue;
                }
                userOptions += `
                    <option value="${ u.id }" ${ u.id == _self.activeUser ? 'selected' : '' }>${ u.first_name } ${ u.last_name }</option>
                `
            }

            //select user, enter password
            //enter a password to access build mode
            _self.modal(
                'Enable Build Mode',
                `<div class="modal-input">
                    <label>Select user</label>
                    <select id="users">
                        <option value="null">Select yourself</option>
                        ${ userOptions }
                    </select>
                </div>
                <div class="modal-input">
                    <label>Enter Your Password</label>
                    <input name="password" type="password" value="" placeholder="enter the password matching your user account above" />
                </div>
                <div class="actions">
                    <button
                        id="checkBuildCredentials"
                        class="button"
                    >Submit</button>
                </div>`,
                null,
                'login'
            );

            //focus the first field
            document.querySelector( '.modal #users' ).focus();

            //listen for enter press
            _self.listenForEnter( document.querySelector( '.modal' ), _self.checkCredentials );

            //check the user and provided pass against the DB pass.
            document.querySelector( '.modal #checkBuildCredentials' ).onclick = _self.checkCredentials;

        });
   }

    //if toggling into build mode check credentials if user not stored in localStorage
    this.checkCredentials = function(){
        const user = document.querySelector( '.modal #users' ).value;
        const pass = document.querySelector( '.modal input[name="password"]' ).value;

        if( typeof user !== 'undefined' && typeof pass !== 'undefined' ){
            _self.post(
                'auth',
                { 
                    user: parseInt( user, 10 ),
                    pass: pass
                },
                function( data ){
                    if( data.status === 'error' ){
                        _self.toast( data.error, 'error' );
                    }else{
                        //close the modal
                        _self.closeModal( document.querySelector( '.modal#login' ) );

                        //store the user as recurring so they don't have to do this much
                        _self.local( 'set', 'user', user );
                        _self.local( 'set', 'userAuth', true );
                        _self.activeUser = user;
                        _self.activeUserAuth = true;

                        _self.enableBuildMode();
                    }
                }
            );
        }else{
            alert( 'username or password is empty' );
        }
    }

    //if a user wants to post a comment and they're not in the user data already
    this.addUser = function(){
        const first_name = document.querySelector( '.modal #first_name' ).value;
        const last_name = document.querySelector( '.modal #last_name' ).value;
        const company = document.querySelector( '.modal #company' ).value;

        console.log( first_name, last_name, company );

        if( typeof first_name === 'undefined' || first_name === '' ){
            alert( 'please enter your first name' );
            return false;
        }

        if( typeof last_name === 'undefined' || last_name === '' ){
            alert( 'Please enter your last name' );
            return false;
        }

        if( typeof company === 'undefined' || company === 'start' ){
            alert( 'Please select a company' );
            return false;
        }

        _self.post(
            'addUser',
            { 
                first_name: first_name,
                last_name: last_name,
                company: company
            },
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    //set the active user
                    const user = data.user.id.toString();
                    _self.activeUser = user;
                    _self.local( 'set', 'user', user );

                    //add the user to the user data array
                    _self.users.push( data.user );

                    //close the modal
                    _self.closeModal( document.querySelector( '.modal#newUser' ) );

                    //resume the comment addition
                    _self.modeControlHandler_addComment();
                }
            }
        );
        
    }




    /************************** HOTSPOTS ****************************/
    /*
        Edit a hotspot
    */
    this.editHotspot = function( event, node, h ){

        if( _self.currentModal === 'editHotspot' ){
            return false;
        }

        const isNew = node.getAttribute( 'data-new' ) === 'true' ? true : false;

        let pos = {
            x: Math.round( parseInt( node.style.left ) ),
            y: Math.round( parseInt( node.style.top ) ),
            w: Math.round( parseInt( node.style.width ) ),
            h: Math.round( parseInt( node.style.height ) )
        }

        //build the modal
        let modalContent = `
            ${ h.isGlobal === true ? `
                <span class='helpText' style="margin-top: -1em; margin-bottom: 1em;">This is a global hotspot, any changes made here will affect all instances</span>
            ` : '' }
            <div class="modal-input">
                <label>Type</label>
                <select id="hotspotType">
                    <option value="click" ${ h.type === 'click' ? 'selected' : null }>Click</option>
                    <option value="hover" ${ h.type === 'hover' ? 'selected' : null }>Hover</option>
                    <option value="overlay" ${ h.type === 'overlay' ? 'selected' : null }>Overlay</option>
                </select>
            </div>
            <div class="modal-input">
                <label>Link</label>
                <input id="hotspotLink" name="link" value="${ h.link }" />
            </div>
            <div class="actions">
                ${ h.isGlobal === true ? `
                    <button
                        id="detatchGlobalHotspot"
                        class="button button--icon destructive"
                    >
                        <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                            <g fill-rule="evenodd">
                                <path d="M25,15 L21,15 L21,16.9 L25,16.9 C26.71,16.9 28.1,18.29 28.1,20 C28.1,21.43 27.12,22.63 25.79,22.98 L27.25,24.44 C28.88,23.61 30,21.95 30,20 C30,17.24 27.76,15 25,15 Z M24,19 L21.81,19 L23.81,21 L24,21 L24,19 Z M10,12.27 L13.11,15.38 C11.29,16.12 10,17.91 10,20 C10,22.76 12.24,25 15,25 L19,25 L19,23.1 L15,23.1 C13.29,23.1 11.9,21.71 11.9,20 C11.9,18.41 13.11,17.1 14.66,16.93 L16.73,19 L16,19 L16,21 L18.73,21 L21,23.27 L21,25 L22.73,25 L26.74,29 L28,27.74 L11.27,11 L10,12.27 Z" fill-rule="nonzero"></path>
                            </g>
                        </svg>
                    </button>
                ` : ``
                }
                <button
                    id="deleteHotspot"
                    class="button button--icon destructive"
                >
                    <svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <g fill-rule="evenodd">
                            <path d="M14,27 C14,28.1 14.9,29 16,29 L24,29 C25.1,29 26,28.1 26,27 L26,15 L14,15 L14,27 Z M16,17 L24,17 L24,27 L16,27 L16,17 Z M23.5,12 L22.5,11 L17.5,11 L16.5,12 L13,12 L13,14 L27,14 L27,12 L23.5,12 Z" fill-rule="nonzero"></path>
                        </g>
                    </svg>
                </button>
                <button
                    id="updateHotspot"
                    class="button"
                >Update</button>
            </div>
        `;

        //calculate where to display the modal relative to the hotspot clicked
        const modalW = 400;
        const modalH = h.isGlobal === true ? 335 : 306;
        let x = event.clientX;
        if( ( x + modalW ) > window.innerWidth ){
            x = x - modalW < 0 ? 10 : x - modalW;
        }
        let y = event.clientY;
        if( ( y + modalH ) > window.innerHeight ){
            y = y - modalH < 0 ? 10 : y - modalH;
        }

        _self.modal(
            `Edit ${ h.isGlobal === true ? 'Global' : '' } Hotspot`,
            modalContent,
            {
                w: modalW,
                h: modalH,
                x: x,
                y: y
            },
            'editHotspot'
        );



        //new hotspot, not saved
        if( isNew === true ){

            //onDelete just delete nodes
            document.querySelector( '.modal #deleteHotspot' ).onclick = function(){
                event.stopPropagation();
    
                _self.closeModal( document.querySelector( '.modal#editHotspot' ) );
                node.remove();
            }

            document.querySelector( '.modal #updateHotspot' ).onclick = () => {

                //check if the link input has a value
                const linkVal = document.querySelector( '.modal #hotspotLink' ).value;
                if( linkVal === '' ){
                    _self.toast( 'Link field is empty, please enter the ID of a slide to link to', 'error' );
                }

                else{
                    //update the data.
                    //still need this in case user wants to manually adjust hotspot size in the inspector and then trigger update here.
                    h.x = pos.x;
                    h.y = pos.y;
                    h.w = pos.w;
                    h.h = pos.h;
                    //ability to update hotspot type and link, need to grab data from modal.
                    h.link = linkVal;
                    h.type = document.querySelector( '.modal #hotspotType' ).value;
        
                    _self.newHotspot( h );
                }  
                
            }
        }

        //existing hotspot
        else{
            document.querySelector( '.modal #updateHotspot' ).onclick = () => {

                //check if the link input has a value
                const linkVal = document.querySelector( '.modal #hotspotLink' ).value;
                if( linkVal === '' ){
                    _self.toast( 'Link field is empty, please enter the ID of a slide to link to', 'error' );
                }

                else{
                    //update the data.
                    //still need this in case user wants to manually adjust hotspot size in the inspector and then trigger update here.
                    h.x = pos.x;
                    h.y = pos.y;
                    h.w = pos.w;
                    h.h = pos.h;
                    //ability to update hotspot type and link, need to grab data from modal.
                    h.link = linkVal;
                    h.type = document.querySelector( '.modal #hotspotType' ).value;
        
                    _self.updateHotspot( h );
                }

            }

            //onDelete just delete nodes
            document.querySelector( '.modal #deleteHotspot' ).onclick = function(){
                event.stopPropagation();

                //if global hotspot we need to soft delete the instance, not the master
                //here h is the master hotspot data.
                if( h.file === 'global'){

                    let hotspotContext = _self.findSlide( event.target );

                    console.log( hotspotContext );

                    let data = {
                        file: hotspotContext.file,
                        name: hotspotContext.name,
                        scrollZone: hotspotContext.scrollZone,
                        hotspotData: h
                    }

                   _self.deleteGlobalHotspot( data, function(){
                        _self.closeModal( document.querySelector( '.modal#editHotspot' ) );
                        node.remove();
                    } );
                }

                //not a global hotspot, just soft delete it
                else{
                    h.state = 'deleted';

                    _self.updateHotspot( h, function(){
                        self.closeModal( document.querySelector( '.modal#editHotspot' ) );
                        node.remove();
                    } );
                }
            }
        }


        
    }

    /*
        Update the hotspot data in the file
    */
    this.updateHotspot = function( h, callback ){
        console.log( 'update hotspot', h );

        _self.post(
            'update/hotspot',
            h,
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'hotspot updated!', 'success' );
                    if( typeof callback === 'function' ){
                        callback();
                    }
                }
            }
        );
    }


    /*
        Add new Hotspot
        Drop a square hotspot on the page, make it draggable and resizable
        Not saved until user updates
    */
    this.addHotspot = function( isGlobal = false ){
        console.log( 'add hotspot', event );

        //re-enable hotspots
        _self.commentModeComplete();

        let hotspotContext = _self.findSlide( event.target );

        let newHotspotData = null;
        let newHotspotNode = null;

        //if global hotspot
        if( isGlobal === true ){
            newHotspotData = _self.newGlobalHotspotData;
            newHotspotNode = _self.hotspot( newHotspotData, hotspotContext.node, true, false );
        }

        //new unqiue hotspot
        else{
            //create hotspot data
            newHotspotData = {
                type: 'click',
                x: event.offsetX,
                y: event.offsetY,
                w: 50,
                h: 50,
                link: "",
                file: hotspotContext.file,
                name: hotspotContext.name
            }

            if( hotspotContext.scrollZone !== null ){
                newHotspotData.scrollZone = hotspotContext.scrollZone;
            }

            //if overlay then need to update the name.
            //name as selected above would be the name of the item, but overlays have 2 layers of items and name is intended to be the higher level one
            if( hotspotContext.overlay !== null ){
                newHotspotData.itemName = hotspotContext.name;
                newHotspotData.name = hotspotContext.overlay.getAttribute( 'id' );
            }

            newHotspotNode = _self.hotspot( newHotspotData, hotspotContext.node, false, true );
        }

        //render hotspot on screen
        if( newHotspotNode !== false ){
            hotspotContext.node.querySelector( '.hotspots' ).appendChild( newHotspotNode );
        }
       
        //if global hotspot save the data since it's done now
        if( isGlobal === true ){
            _self.newGlobalHotspot( newHotspotData, hotspotContext.file, hotspotContext.name, hotspotContext.scrollZone );
        }

        //after click turn off adding annotation mode
        _self.addingHotspot = false;
        _self.modeControls.querySelector( '#addHotspot' ).classList.remove( 'active' );
    }

    /*
        New Hotspot
        Save a hotspot for the first time
        Called after adding a new hotspot then dragging or resizing
        Called after adding new hotspot then opening and updating the link (but not dragging/resizing first)
    */
    this.newHotspot = function( hotspotData ){
        event.stopPropagation();

        console.log( hotspotData );

        if( typeof hotspotData.id === 'undefined' ){
            console.log( 'need to add ID' );
            hotspotData.id = _self.createGuiID();
        }

        _self.post(
            'add/hotspot',
            { 
                data: hotspotData
            },
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'hotspot successfully added!', 'success' );
                }
            }
        );
    }

    /*
        New Gloabl Hotspot
        Add a global hotspot to the slide/scrollZone data
        Called after user selects location to add the hotspot, called by addHotspot();
    */
    this.newGlobalHotspot = function( hotspotData, file, name, scrollZone ){
        event.stopPropagation();

        console.log( hotspotData, file, name, scrollZone );


        _self.post(
            'add/globalHotspot',
            { 
                file: file,
                name: name,
                scrollZone: scrollZone,
                data: hotspotData
            },
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'global hotspot successfully added!', 'success' );
                }
            }
        );
    }

    /*
        Delete an instance of a global hotspot
        Just deletes it from the slide, doesn't delete the master
    */
    this.deleteGlobalHotspot = function( h, callback ){
        console.log( 'delete instance of global hotspot', h );

        _self.post(
            'delete/globalHotspot',
            h,
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'hotspot updated!', 'success' );
                    if( typeof callback === 'funnction' ){
                        callback();
                    }
                }
            }
        );
    }



    /*
        Make this a draggable and resizeable hotspot
    */
    this.makeHotspotDraggable = function( node, h ){
        const hotspotDragState = node.getAttribute( 'data-draggable' );
        if( hotspotDragState === 'true' ){
            console.warn( 'hotspot is already draggable' );
            return false
        }

        //timeout for saving after resizing
        let resizing = null;
        let dragging = null;

        interact( node )
            .draggable({
                onmove: function( event ){
                    const target = event.target

                    clearTimeout( dragging );

                    // determine what the new X and Y position of the object should be based on starting position and dragX and dragY distances
                    let x = ( parseFloat( target.style.left ) || 0 ) + event.dx;
                    let y = (parseFloat( target.style.top) || 0) + event.dy;
                    
                    // reset the top/left position
                    target.style.left = `${ x }px`;
                    target.style.top = `${ y }px`;
                    
                    //auto save when dragging is done
                    dragging = setTimeout( () => {
                        h.x = x;
                        h.y = y;
                        _self.updateHotspot( h );
                    }, 1000 );
                },
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent'
                    })
                ]
            })
            .resizable({
                // resize from all edges and corners
                edges: { left: true, right: true, bottom: true, top: true },

                modifiers: [
                    // keep the edges inside the parent
                    interact.modifiers.restrictEdges({
                        outer: 'parent',
                        endOnly: true
                    }),

                    // minimum size
                    interact.modifiers.restrictSize({
                        min: { width: 40, height: 40 }
                    })
                ],

                inertia: true
            })
            .on('resizemove', function (event) {
                var target = event.target

                //clear previous resize timeout
                clearTimeout( resizing );

                let x = ( parseFloat( target.style.left ) || 0 );
                let y = (parseFloat( target.style.top) || 0);

                // update the element's style
                target.style.width = `${ event.rect.width }px`;
                target.style.height = `${ event.rect.height }px`;

                // move the hotspot if resizing from top or left
                x += event.deltaRect.left;
                y += event.deltaRect.top;
                target.style.left = `${ x }px`;
                target.style.top = `${ y }px`;

                resizing = setTimeout( () => {
                    console.log( 'save resize' );

                    //update the data
                    h.x = Math.round( x );
                    h.y = Math.round( y );
                    h.w = Math.round( event.rect.width );
                    h.h = Math.round( event.rect.height );

                    //if new hotspot
                    if( node.getAttribute( 'data-state' ) === 'newHotspot' ){
                        console.log( 'new hotspot' );
                    }

                    //if existing hotspot
                    else{
                        _self.updateHotspot( h );
                    }
                    
                }, 1000 );
            })
            .on('doubletap', function (event) {
                _self.editHotspot( event, node, h );
                event.preventDefault()
            });
            

        node.setAttribute( 'data-draggable', 'true' );
    }


    /************************** COMMENTS ****************************/
    /*
        Make this a draggable and resizeable hotspot
    */
    this.makeCommentDraggable = function( c, node, isNewComment ){
        const commentDragState = node.getAttribute( 'data-draggable' );
        if( commentDragState === 'true' ){
            console.warn( 'comment is already draggable' );
            return false
        }

        interact( node )
            .draggable({
                onmove: function( event ){
                    const target = event.target;

                    if( event.target.classList.contains( 'active' ) ){
                        //do nothing when commment is open
                    }else{
                        // determine what the new X and Y position of the object should be based on starting position and dragX and dragY distances
                        let x = ( parseFloat( target.style.left ) || 0 ) + event.dx;
                        let y = ( parseFloat( target.style.top ) || 0 ) + event.dy;
                        
                        // reset the top/left position
                        target.style.left = `${ x }px`;
                        target.style.top = `${ y }px`;
                    }
                    
                },
                onend: function( event ){

                    if( event.target.classList.contains( 'active' ) ){
                        console.log( 'comment is open, disable drag' );
                    }else{
                        //update the comment data
                        c.x = Math.round( parseFloat( node.style.left ) );
                        c.y = Math.round( parseFloat( node.style.top ) );

                        //save the update
                        //if new comment refetch the data because it likely won't match what was originally passed to this function
                        if( isNewComment === true ){
                            let commentForm = _self.dataPieces[ c.file ][ c.name ];
                            if( c.file === 'overlay' ){
                                let item = c.itemName;
                                commentForm = commentForm.items.find( (i) => {
                                    return i.name === item;
                                });
                            }
                            if( typeof c.scrollZone !== 'undefined' ){
                                commentForm = commentForm.scrollZones.find( ( s ) => {
                                    return s.id === c.scrollZone;
                                });
                            }
                            const commentData = _self.getComment( commentForm, c.id );
                            c.type = commentData.type;
                            c.comment = commentData.comment;
                        }
                        _self.updateComment( c, null );
                    }
                },
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent'
                    })
                ]
            })
            
            /*.on('doubletap', function (event) {
                _self.editHotspot( event, node );
                event.preventDefault()
            });*/
            

        node.setAttribute( 'data-draggable', 'true' );
    }


    /*
        New comment
        Save a comment for the first time
        Called after adding a new annotation or comment and then pushing the "update" button
    */
    this.newComment = function( commentData, commentNode, callback ){
        event.stopPropagation();
        console.log( 'new comment:', commentData );

        if( typeof commentData.id === 'undefined' ){
            console.log( 'need to add ID' );
            commentData.id = _self.createGuiID();
        }

        //get the latest value of the comment
        commentData.quill = _self.commentEditor.getContents();
        commentData.comment = _self.commentEditor.getText();

        //get the latest value of the type dropdown
        commentData.type = commentNode.querySelector( '#comment-type' ).value;

        _self.post(
            'add/comment',
            { 
                data: commentData
            },
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'comment updated!', 'success' );
                    if( typeof callback === 'function' ){
                        callback( data, commentData );
                    }
                }
            }
        );
    }


    /*
        Update a comment
        Called by pushing the "update" button anytime except in the case above.
    */
    this.updateComment = function( commentData, commentNode, callback, resolveOnly = false ){

        console.log( 'update existing comment:', commentData );
        
        //if dragging a comment the comment popup isn't visible so the commentNode param is null
        //if not null then get the latest values from the popup
        if( commentNode !== null && resolveOnly !== true ){

            //get the latest value of the comment
            //commentData.comment = commentNode.querySelector( '.comment-value' ).innerHTML;
            commentData.quill = _self.commentEditor.getContents();
            commentData.comment = _self.commentEditor.getText();

             //get the latest value of the type dropdown
            commentData.type = commentNode.querySelector( '#comment-type' ).value;
        }


        //get the current user making the update
        if( resolveOnly !== true ){
            commentData.user = _self.activeUser;
        }

        //hit the API
        _self.post(
            'update/comment',
            { 
                data: commentData
            },
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'comment updated!', 'success' );
                    if( typeof callback === 'function' ){
                        callback( data );
                    }
                }
            }
        );
    }

     /*
        Callback for updating a hotspot, change color etc as needed
    */
    this.updateCommentCallback = function( node, h ){
        console.log( 'update hotspot' );
        node.setAttribute( 'data-type', h.type );
    }

    /*
        Delete a comment
    */
    this.deleteComment = function( commentData, callback ){

        //confirmation modal
        _self.confirmation(
            'Are you sure you would like to delete this comment?',
            ( result ) => {
                if( result === true ){
                    console.log( 'delete comment' );
                    _self.post(
                        'delete/comment',
                        { 
                            data: commentData
                        },
                        function( data ){
                            if( data.status === 'error' ){
                                _self.toast( 'comment deletion failed!', 'error' );
                            }else{
                                _self.toast( 'comment deleted!', 'success' );
                            }  

                            if( typeof callback === 'function' ){
                                callback( data );
                            }
                        }
                    );
                }
            }
        );
        
    }



    /*
        Add Annotation
    */
    this.addAnnotation = function(){
        console.log( 'add annotation', event );

        //re-enable hotspots
        _self.commentModeComplete();

        let commentContext = _self.findSlide( event.target );

        //create hotspot data
        let newComment = {
            id: _self.createGuiID(),
            type: "logic",
            x: event.offsetX,
            y: event.offsetY,
            comment: 'enter your comment here',
            user: _self.activeUser, //active user is known because it's defined when logging into build mode
            file: commentContext.file,
            name: commentContext.name
        }

        //if overlay then need to update the name.
        //name as selected above would be the name of the item, but overlays have 2 layers of items and name is intended to be the higher level one
        if( commentContext.overlay !== null ){
            newComment.itemName = commentContext.name;
            newComment.name = commentContext.overlay.getAttribute( 'id' );
        }
        
        //if within a scrollzone
        if( commentContext.scrollZone !== null ){
            newComment.scrollZone = commentContext.scrollZone;
        }

        console.log( 'new comment data:', newComment );

        //render hotspot on screen
        commentContext.node.querySelector( '.comments' ).appendChild( _self.comment( newComment, commentContext.node, commentContext.data, true ) );


        //after click turn off adding annotation mode
        _self.addingAnnotation = false;
        _self.modeControls.querySelector( '#addAnnotation' ).classList.remove( 'active' );
    }

    /*
        Add Comment
        Same as an annotation except types are limited to Note/Question
    */
    this.addComment = function(){
        console.log( 'add comment', event );

        //re-enable hotspots
        _self.commentModeComplete();

        let commentContext = _self.findSlide( event.target );
        
         //create hotspot data
         let newComment = {
            id: _self.createGuiID(),
            type: "note",
            x: event.offsetX,
            y: event.offsetY,
            comment: 'enter your comment here',
            user: _self.activeUser, //active user is known because it's defined when logging into build mode
            file: commentContext.file,
            name: commentContext.name
        }

        //if overlay then need to update the name.
        //name as selected above would be the name of the item, but overlays have 2 layers of items and name is intended to be the higher level one
        if( commentContext.overlay !== null ){
            newComment.itemName = commentContext.name;
            newComment.name = commentContext.overlay.getAttribute( 'id' );
        }

        if( commentContext.scrollZone !== null ){
            newComment.scrollZone = commentContext.scrollZone;
        }

        console.log( 'new comment data:', newComment );

        //render comment on screen
        commentContext.node.querySelector( '.comments' ).appendChild( _self.comment( newComment, commentContext.node, commentContext.data, true ) );


        //after click turn off adding annotation mode
        _self.addingComment = false;
        _self.modeControls.querySelector( '#addComment' ).classList.remove( 'active' );
    }


    /*
        Change slide status
    */
    this.changeStatus = function(){
        console.log( 'change slide status' );

        if( _self.currentModal === 'changeStatus' ){
            return false;
        }

        //determine current status
        const node = document.querySelector( '.item.active .metadata .status' );
        const currStatus = node.getAttribute( 'data-status' );

        console.log( currStatus );

        //show the modal for changing status
        //build the modal
        let modalContent = `
            <div class="statusOptions">
                <div id="onHold" class="modal-input" data-status="${ currStatus === 'onHold' ? 'active' : 'inactive'}">
                    <span>On Hold</span>
                </div>
                <div id="conceptual" class="modal-input" data-status="${ currStatus === 'conceptual' ? 'active' : 'inactive'}">
                    <span>Conceptual</span>
                </div>
                <div id="inProgress" class="modal-input" data-status="${ currStatus === 'inProgress' ? 'active' : 'inactive'}">
                    <span>In Progress</span>
                </div>
                <div id="approved" class="modal-input" data-status="${ currStatus === 'approved' ? 'active' : 'inactive'}">
                    <span>Stakeholder Approved</span>
                </div>
            </div>
        `;

        //calculate where to display the modal relative to the hotspot clicked
        const modalW = 230;
        const modalH = 172;
        let x = event.clientX;
        if( ( x + modalW ) > window.innerWidth ){
            x = x - modalW < 0 ? 10 : x - modalW;
        }
        let y = event.clientY;
        if( ( y + modalH ) > window.innerHeight ){
            y = y - modalH < 0 ? 10 : y - modalH;
        }

        _self.modal(
            null,
            modalContent,
            {
                w: modalW,
                h: modalH,
                x: x,
                y: y
            },
            'changeStatus'
        );

        for( let i of document.querySelectorAll( '.modal-input' ) ){
            i.onclick = _self.updateStatus;
        }
    }


    /*
        Update slide status
    */
    this.updateStatus = function(){
        const target = _self.getParent( event.target, '.modal-input' );
        const status = target.getAttribute( 'id' );
        console.log( 'update status', status );

        //hit the API
        _self.post(
            'update/status',
            { 
                file: _self.activeSlide.file,
                name: _self.activeSlide.name,
                status: status
            },
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'slide status updated!', 'success' );
                }
            }
        );
    }

    /*
        Trigger merge of two file
        Old file = name of file with extension, such as "issue.json";
        new file = name of file with extension
    */
    this.mergeFiles = function( oldFile, newFile ){

        //hit the API
        _self.post(
            'mergeData',
            { 
                existingFile: oldFile, //function is expecting only file name
                newFile: `./public/data/merge/${ newFile }` //function is expecting full path
            },
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'files successfully merged!', 'success' );
                }
            }
        );
    }


    /*
        Trigger audit of a file
    */
    this.audit = function( file ){

        //hit the API
        _self.post(
            'audit',
            { 
                file: file
            },
            function( data ){
                if( data.status === 'error' ){
                    _self.toast( data.error, 'error' );
                }else{
                    _self.toast( 'audit completed', 'success' );
                }
            }
        );
    }



    /*
        Fetching Data
    */

    //load a data file
    this.loadData = function( name, callback ){
        _self.get( name, ( data ) => {

            //loop through data and label it with the file it came from
            for( let d in data ){
                data[ d ].name = d;
                data[ d ].file = name;
            }

            //add the data to the main data bucket
            _self.dataPieces[ name ] = data;

            //run the callback
            callback();
        } );
    } 

    //Get Data
    this.get = function( endpoint, callback ){

        fetch( `/data/${ endpoint }` )
            .then( response => response.json() )
            .then( resp => {
                callback( resp );
            });
    }

    //Post Data
    this.post = function( endpoint, content, callback ){

        fetch( 
            `${ endpoint }`,
            {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify( content )
            }
        )
        .then( response => response.json() )
        .then( function( data ) {
            console.log( data );
            if( typeof callback === 'function' ){
                callback( data );
            }
        })
        .catch( function( error ){
            console.log( "error:", error );
            _self.toast( 'Server error, action cannot be completed.', 'error' );
        });
    }




    /*
        Load first item
    */
    this.load = function () {

        //setup mode
        _self.setupMode();
    
        if( window.location.search !== "" ){
            _self.navigation.read();
        } else {
            const item = this.dataPieces[ 'feature' ].features;
            this.node( item );
            _self.navigation.write( 'features', _self.mainContext);
        }
        
    };

    

    /*
        Process data
        determines which data to load for the current slide
    */
    this.processData = (function () {

        //load users
        _self.get( 'users', ( data ) => {
            if( data !== null ){
                _self.users = data;
            }
        } );

        //load all data
        let loadedData = 0;
        for( let el in _self.dataPieces ){
            _self.loadData(
                el,
                () => {
                    //console.log( 'data loaded for', el );
                    loadedData++;
                }
            );
        }
        const checkData = setInterval( function(){
            if( loadedData === Object.keys( _self.dataPieces ).length ){
                clearInterval( checkData );
                console.log( 'all data loaded', _self.dataPieces );
                _self.load();
                _self.fillDrawer();
            }
        }, 500 );

    })();






    /***************************** Helper functions *****************************/

    //get parent with selectors
    this.getParent = function (el, selector) {
        for (; el && el !== document; el = el.parentNode) {
            if (el.matches(selector)) {
                return el;
            }
        }
        return null;
    };

    /*
        Get all comments from the node
    */
    this.getComments = function( item ){
        let comments = null;
        if (typeof item.comments === 'object' && item.comments.length > 0) {
            comments = item.comments;
        }
        if (typeof item.scrollZones === 'object') {
            for (let s of item.scrollZones) {
                if (typeof s.comments === 'object' && s.comments.length > 0) {
                    if (comments !== null) {
                        comments = comments.concat(s.comments);
                    } else {
                        comments = s.comments;
                    }

                }
            }
        }

        return comments;
    }

    /*
        Get a specific comment by ID
    */
    this.getComment = function( item, id ){
        const allComments = _self.getComments( item );
        const comment = allComments.find( ( c ) => {
            return c.id === id;
        });
        return comment;
    }

    /*
        Get all comments for a specific module (file)
    */
    this.getCommentsByModule = function( file, showResolved = false ){
        let comments = [];

        //loop through all data nodes in the file
        //find comments for nodes using the _self.getComments function
        //filter out any that are resolved (if showResolved is not true)
        for( let data in _self.dataPieces[ file ] ){
            const d = _self.dataPieces[ file ][ data ];
            
            let nodeComments = _self.getComments( d );

            if( nodeComments !== null ){
                for( let c of nodeComments ){
                    if( c.type === 'deleted' ){
                        continue;
                    }
                    let slide = comments.find( (s) => {
                        return s.slide === d.name;
                    });
                    if( typeof slide === 'undefined' ){
                        comments.push({
                            slide: d.name,
                            img: d.img,
                            comments: []
                        });
                        slide = comments.find( (s) => {
                            return s.slide === d.name;
                        });
                    }
                    slide.comments.push( c );
                }
            }
        }

        console.log( comments );

        const slideName = `all_${ file }_comments`;

        //check if this slide already exists or create it
        if( _self.wrap.querySelector( `#${ slideName }`) !== null ){
            _self.hideActive();
            _self.wrap.querySelector( `#${ slideName }`).classList.add( 'active' );

            //push into browser history
             _self.navigation.write( slideName, _self.mainContext );

        }
        //add a slide for this
        else{
            _self.createSlide( comments, slideName, 'allComments' );
        }
    }

    /*
        Annotation / Comment Mode
    */
    this.setupCommentMode = function( mode, node ){

        //add the close button
        if( document.querySelectorAll( '.exitMode' ).length < 1 ){
            const closeX = document.createElement('div');
            closeX.className = `exitMode`;
            closeX.innerHTML = `
                <span class="closeX">+</span>
            `;
            document.querySelector( 'body' ).appendChild( closeX );

            //on click cancel
            closeX.onclick = function(){
                _self.removeCommentMode( mode, node );
            }
        }

        _self[ mode ] = true;
        _self.modeControls.querySelector( node ).classList.add( 'active' );
        
        //disable hotspots through CSS so click events aren't triggered.
        document.body.setAttribute( 'data-disabledHotspots', true );
        document.body.classList.add( mode );

        //update the cursor
        document.body.style.cursor = 'cell';

    }
    this.removeCommentMode = function( mode, node ){
        _self[ mode ] = false;
        _self.modeControls.querySelector( node ).classList.remove( 'active' );
        document.body.setAttribute( 'data-disabledHotspots', false );
        document.body.classList.remove( mode );
        document.body.style.cursor = 'default';

        setTimeout( function(){
            document.querySelector( '.exitMode' ).remove();
        }, 300 );
    }
    this.commentModeComplete = function(){
        document.body.setAttribute( 'data-disabledHotspots', false );
        document.body.classList.remove( 'addingAnnotation' );
        document.body.classList.remove( 'addingComment' );
        document.body.classList.remove( 'addingHotspot' );
        document.body.classList.remove( 'addingGlobalHotspot' );
        document.body.style.cursor = 'default';
    }

    this.removeActiveComments = function(){
        let openComments = _self.wrap.querySelectorAll( '.comment.active' );
        for( let c of openComments ){
            c.remove();
        }
    }

    /*
        hide all active slides
    */
    this.hideActive = function( context ){
        if( typeof context === 'undefined' ){
            context = _self.wrap;
        }
        const activeItems = context.querySelectorAll('.item.active');
        if( activeItems.length > 0 ){
            for (let i of activeItems) {
                i.classList.remove('active');
            }
        }
    }

    /*
        Create a slide programmatically when needed
        This slide does not get saved into the data and only exists temporarily.
    */
    this.createSlide = function( data, name, type ){

        const slideData = {
            "id": _self.createGuiID(),
            "name": name
        }

        if( typeof data.img !== 'undefined' ){
            slideData.img = data.img;
        }else{
            slideData.img = null;
        }

        //hide any active slides
        _self.hideActive();

        //append the new slide
        _self.node( slideData, _self.wrap, _self.mainContext, false );
        
        const slide = _self.wrap.querySelector( '.active' );
        slide.classList.add( 'dynamic' );

        //custom stuff
        //these dynamically created slides will typically have custom content on them, so add that content now based on the Type prop.
        if( type === 'allComments' ){

            //status sort-by also has filters to 
            let filterOptions = [
                {
                    name: 'Open Comments',
                    value: true
                },
                {
                    name: 'Completed',
                    value: false
                }
            ];

            //filter the data if needed
            //apply or remove the filter from the array above
            function adjustFilters( filter ){
                let item = filterOptions.find( option => {
                    return option.name === filter;
                });
                item.value = !item.value;
            }

            //determine if a filter is active
            function filterActive( filter ){
                const item = filterOptions.find( option => {
                    return option.name.toLowerCase() === filter.toLowerCase();
                });
                return item.value === true ? 'active' : 'disabled';
            }

        
            function generateCommentHTML(){

                //use the name prop but remove the underscores and replace with spaces
                const title = name.replace( /_/g, ' ' );

                //build the HTML to display a slide with it's comments
                let slides = '';
                
                //each node in the data array is a slide with a comments array
                for( let d of data ){

                    //generate the HTML for each comment within this slide
                    let comments = '';
                    for( let c of d.comments ){

                        //skip deleted comments
                        if( c.type === 'deleted' ){
                            continue;
                        }

                        //if the filter isn't active for this comment then skip
                        //not all comments have the resolved prop - it's newer
                        if( typeof c.resolved !== 'undefined' ){

                            //if resolved and the filter is set to hide resolved items
                            if( c.resolved === true && filterOptions[ 1 ].value === false ){
                                continue;
                            }

                            //if not resolved and the filter is set to hide open items
                            if( c.resolved === false && filterOptions[ 0 ].value === false ){
                                continue;
                            }
                        }
                        
                        //if the resolved prop doesn't exist on the comment then assume it's open
                        else{
                            if( filterOptions[ 0 ].value === false ){
                                continue;
                            }
                        }


                        comments += `
                            <div class="comment allComments--slide--comment" data-type='${ c.type }' data-resolved='${ c.resolved === true ? 'true' : 'false' }'>
                                <p>${ c.comment }</p>
                            </div>
                        `;
                    }

                    //generate the HTML for this slide
                    const slideTitle = d.slide.replace( /_/g, ' ' );
                    slides += `
                        <div class='allComments--slide'>
                            <div class="allComments--slide--info">
                                <a href="/?id=${ d.slide }&context=protoWrap">
                                    <p>${ slideTitle }</p>
                                    <img src="img/${ d.img }" />
                                </a>
                            </div>
                            <div class="allComments--slide--comments">
                                ${ comments }
                            </div>
                        </div>
                    `;
                }
                
                slide.innerHTML = `
                    <div class='slideHeader'>
                        <h1 class='slideHeader--title'>
                            <a class="backArrow" href="javascript:history.back()">Go Back</a>
                            ${ title }
                        </h1>
                    </div>
                    <div class="controls">
                        <div class="features_sort">
                            <span>Sort:</span>
                            <div class="features_sort_option active" id="slideName">
                                Slide Name
                            </div>
                        </div>
                        <div class="features_filter">
                            <span>Filter:</span>
                            <div class="features_filter_option ${ filterActive( 'Open Comments' ) }" id="Open Comments">
                                Open Comments
                            </div>
                            <div class="features_filter_option ${ filterActive( 'Completed' ) }" id="Completed">
                                Completed Comments
                            </div>
                        </div>
                    </div>
                    <div class="content">${ slides }</div>
                `


                //setup the filtering options
                const filters = slide.querySelectorAll( '.features_filter_option' );
                for( let f of filters ){
                    f.addEventListener( 'click', () => filterBy( f.getAttribute( 'id' ) ) );
                }


                /*
                    filter by
                */
                function filterBy( filterProp ){
                    event.stopPropagation();

                    //remove the items
                    slide.innerHTML = '';

                    //update the filters
                    adjustFilters( filterProp );

                    //repopulate
                    generateCommentHTML();
                }

            }
            generateCommentHTML();
        }


    }


    // create GUIID
    // used for unique identifier for comments (and maybe for hotspots in the future)
    this.createGuiID = function(){
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function( c ){
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Local storage stuff
    this.local = function( method, prop, value ){
        if( method === 'get' ){
            return localStorage.getItem( prop );
        }
        if( method === 'set' ){
            localStorage.setItem( prop, value );
        }
    }

    /*
        Find a user by ID
        Return the user object
    */
    this.findUser = function( userID ){
        userID = parseInt( userID, 10 );
        const u = _self.users.find( ( u ) => {
            return u.id === userID;
        });
        if( u !== 'undefined' ){
            return u;
        }else{
            return null;
        }
    }

    /*
        Create a human readable date from a JS date object
        Uses the Time Ago function to put the date in a human readable format
    */
    this.humanDate = function( date, includeTime = false ){
        let d = new Date( date );
        return _self.timeAgo( `${ d.toDateString() } ${ d.toLocaleTimeString() }` );
    }
    this.timeAgo = function( time ){

        var templates = {
            prefix: "",
            suffix: " ago",
            seconds: "less than a minute",
            minute: "about a minute",
            minutes: "%d minutes",
            hour: "about an hour",
            hours: "about %d hours",
            day: "a day",
            days: "%d days",
            month: "about a month",
            months: "%d months",
            year: "about a year",
            years: "%d years"
        };
        var template = function(t, n) {
            return templates[t] && templates[t].replace(/%d/i, Math.abs(Math.round(n)));
        };
   
        if( !time ){
            return;
        } 
        time = time.replace(/\.\d+/, ""); // remove milliseconds
        time = time.replace(/-/, "/").replace(/-/, "/");
        time = time.replace(/T/, " ").replace(/Z/, " UTC");
        time = time.replace(/([\+\-]\d\d)\:?(\d\d)/, " $1$2"); // -04:00 -> -0400
        time = new Date(time * 1000 || time);

        var now = new Date();
        var seconds = ( ( now.getTime() - time ) * .001 ) >> 0;
        var minutes = seconds / 60;
        var hours = minutes / 60;
        var days = hours / 24;
        var years = days / 365;

        return templates.prefix + (
            seconds < 45 && template('seconds', seconds) ||
            seconds < 90 && template('minute', 1) ||
            minutes < 45 && template('minutes', minutes) ||
            minutes < 90 && template('hour', 1) ||
            hours < 24 && template('hours', hours) ||
            hours < 42 && template('day', 1) ||
            days < 30 && template('days', days) ||
            days < 45 && template('month', 1) ||
            days < 365 && template('months', days / 30) ||
            years < 1.5 && template('year', 1) ||
            template('years', years)
            ) + templates.suffix;
        
       
        
    }

    /*
        Enter key press listener
    */
    this.listenForEnter = function( node, callback ){

            //listen for enter press
            node.addEventListener("keyup", function( event ){

                // Number 13 is the "Enter" key on the keyboard
                if( event.keyCode === 13 ){
                    // Cancel the default action, if needed
                    event.preventDefault();
                    
                    //trigger the callback
                    if( typeof callback === 'function' ){
                        callback();
                    }
                }
            });
    }

    /*
        Get Absolute Position
        Get the position of something relative to the prototype wrap node
        Return X Y position
    */
    this.getAbsolutePosition = function( node ){

        //get the position in the overall viewport
        const viewportOffset = node.getBoundingClientRect();

        // these are relative to the viewport, i.e. the window
        let top = viewportOffset.top + window.scrollY;
        let left = viewportOffset.left + window.scrollX - _self.wrap.offsetLeft;

        return {
            x: left,
            y: top
        };
    }



    /*
        Find the slide and/or scrollZone parent for a given node
        find the data for that slide
        determine if it's within an overlay or not
    */
    this.findSlide = function( target ){
        //figure out which node this hotspot should be contained within
        //walk up till we find a scrollZone or a slide, try scrollZone first
        let node = _self.getParent( target, '.scrollZone' );
        let nodeParent = null; //used to find the item if the node is a scrollZone
        if( node === null ){
            node = _self.getParent( target, '.item' );
        }else{
            nodeParent = _self.getParent( node, '.item' );
        }

        //now find the associated data for the node or nodeParent
        //were looking for the slide data, not just the scrollZone.
        let context = _self.mainContext;
        let data = null;
        let file = null;
        let name = null;
        let scrollZone = null;

        //if the annotation is within an overlay then find the overlay context
        let isOverlay = _self.getParent( node, '.overlay' );
        if( isOverlay !== null ){
            context = isOverlay.getAttribute( 'id' );
        }

        if( nodeParent !== null ){
            //find data from the node parent (slide when node is a scrollZone)
            data = _self.find( nodeParent.getAttribute( 'id' ), context );
            file = data.file;
            name = data.name;

            console.log( data );

            //find the scrollzone data
            data = data.scrollZones.find( ( s ) => {
                return s.id === node.getAttribute( 'id' );
            });
            scrollZone = data.id;
        }else{
            //find date from the node (slide)
            data = _self.find( node.getAttribute( 'id' ), context );
            file = data.file;
            name = data.name;
        }

        console.log( file, name, scrollZone );

        return {
            node: node,
            data: data,
            file: file,
            name: name,
            scrollZone: scrollZone,
            overlay: isOverlay
        }
    }


    /*
       Click anywhere to do stuff
    */
    document.querySelector( '.slidesAndCommentsWrap' ).onclick = function () {

        //if in draw mode then disable
        /*if (_self.drawMode === true) {
            return false;
        }*/

        if( _self.addingAnnotation === true ){
            _self.addAnnotation();
            return false;
        }

        if( _self.addingComment === true ){
            _self.addComment();
            return false;
        }

        if( _self.addingHotspot === true ){
            _self.addHotspot();
            return false;
        }

        if( _self.addingGlobalHotspot === true ){
            _self.addHotspot( true );
            return false;
        }

        for( let h of document.querySelectorAll('.hotspot') ){
            _self.pulseHotspot(h);
        }

        //close any open comments
        _self.removeActiveComments();

        //close any open modals
        const openModals = document.querySelectorAll( '.modal' );
        for( let m of openModals ){
            self.closeModal( m );
        }

        //close any open quill editors
        if( typeof _self.commentEditor !== 'undefined' ){
            _self.commentEditor.blur();
        }
        
    }

    /*
        Pulse Hotspot to show where they are
        Not needed when in build mode
    */
    this.pulseHotspot = function (h) {
        if( _self.mode !== 'build' ){
            h.classList.add('pulse');
            setTimeout(() => {
                h.classList.remove('pulse');
            }, 1000);
        }   
    }

    //left & right arrows
    document.onkeydown = function( e ){

        e = e || window.event;

        // up arrow
        if (e.keyCode == '38') {
            
        }

        // down arrow
        else if (e.keyCode == '40') {
            
        }

        // left arrow
        else if (e.keyCode == '37') {
            
            console.log( 'left arrow press' );
        }

        // right arrow
        else if (e.keyCode == '39') {
            
            console.log( 'right arrow press' );

            //find the next slide name
            //data is an object so order of items changes to be alphabetical. This makes going to "next" really hard.
            //let newItemName = 

            //change to that item
            //_self.changeItem( newItemName, _self.mainContext );
        }

    }

    //on browser navigation adjust item
    window.onpopstate = function (historyItem) {
        _self.navigation.goTo(historyItem.state);
    }

    
    //expose this as a global var so it can be accessed in the console
    window.proto = _self;

}());