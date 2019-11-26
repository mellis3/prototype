const express = require('express');
const app = express();
const port = 3000;
const reload = require('require-reload')(require);
const fs = require( 'fs' );

app.use( express.static('public') );
app.use( express.json() );

app.get('/', (req, res) => res.send('Hello World!'));

/*
    fetch a JSON file and return it as an object, not a string
*/
function jsonReader( filePath, callback ){
    fs.readFile( filePath, (err, fileData) => {
        if( err ){
            if( err.errno !== -2 ){
                console.log( err );
                updateLog( err, 'error' );
            }
            return callback && callback( err );
        }
        try {
            const object = JSON.parse( fileData );
            return callback && callback( null, object );
        } catch(err) {
            console.log( err );
            updateLog( err, 'error' );
            return callback && callback( err );
        }
    })
}

/*
    Create / Update log file
    Get the current log, modify it, save it
*/
function updateLog( logMessage, status ){

    //get today's date
    let date = new Date;
    let today = date.toDateString();
    today = today.replace(/\s+/g, '-');

    const fileDir = `./public/data/_log/${ today }/`;

    //run the function to find or make the directory
    //we'll make a new directory for each day
    checkDirectory( fileDir, ( error ) => { 
        //there was an error of some sort
        //can't move forward so break out of this function
        if( error ){
            console.log("oh no!!!", error);
            return false;
        } 
    });

    //get the file
    jsonReader(
        `${ fileDir }${ date.getHours() }.json`,
        ( err, data ) => {

            //file can't be retrieved errors
            if( err ){
                //console.log( err );

                //no file exist is errno -2, if anything other than that then exit
                if( err.errno !== -2 ){
                    return;
                }
            }

            if( typeof data === 'undefined' ){
                data = [];
            }

            data.push( {
                type: status,
                log: logMessage,
                timestamp: date
            } );

            //update the file with the new data
            fs.writeFile( `${ fileDir }${ date.getHours() }.json`, JSON.stringify( data ), err => {
                if (err) {
                    console.log('Error writing file', err)
                } else {
                    console.log('Successfully wrote file');
                }
            });
        }
    );
}

/*
    Find directory
    Return if exists
    Make if does not exist, then return
*/
function checkDirectory( directory, callback ){  
    //if directory does not exist
    if( !fs.existsSync( directory ) ){
        //make directory
        try{
            fs.mkdirSync( directory );
        }
        //failed to make directory for some error
        catch( error ){
            if( typeof callback === 'function' ){
                callback( error );
            }
        }
    }
    
    //if directory already exists
    else{
        callback();
    }
}

/*
    List contents of a directory
*/
function listDirectory( directory, callback ){
    fs.readdir( directory, ( err, files ) => {
        //handling error
        if (err) {
            callback( err );
            return console.log('Unable to scan directory: ' + err);
        } 
        callback( files );
    });
}

/*
    Create an archived version of a file
    In the archive folder
    By file name
    By date - one folder per day
*/
function createArchive( filename, data ){
    console.log( 'creating an archive of this file', filename );

    //get today's date
    let date = new Date;
    let today = date.toDateString();
    today = today.replace(/\s+/g, '-');
    
    const fileDir = `./public/data/_archive/${ filename }/${ today }/`;

    //run the function to find or make the directory
    //we'll make a new directory for each day
    checkDirectory( fileDir, ( error ) => { 
        //there was an error of some sort
        //can't move forward so break out of this function
        if( error ){
            console.log("oh no!!!", error);
            return false;
        } 
    });

    //we'll make a new file each hour
    //write data to the file, this will replace the contents of the entire file
    //if the file doesn't exist this will create it
    fs.writeFile( `${ fileDir }${ date.getHours() }.json`, JSON.stringify( data ), err => {
        if( err ){
            console.log('Error writing archive file', err)
        }else{
            console.log('Successfully wrote to archive file')
        }
    });
    
}

/*
    Merge an existing data file with a new file
    Follow the rules for merging to prevent data loss
*/
function mergeFiles( existingFile, pathToNewFile, callback ){
    existingFile = './public/data/' + existingFile;

    console.log( 'merge these two files', existingFile, pathToNewFile );
    updateLog( `merge these two files, ${ existingFile }, ${ pathToNewFile }`, 'note' );

    //get the existing file
    jsonReader(
        existingFile,
        ( err, data ) => {

            const existingData = data;

            //file can't be retrieved errors
            if( err ){
                console.log( err );
                updateLog( err, 'error' );
                if( typeof callback === 'function' ){
                    callback( { status: 'error', error: err } );
                }
                return;
            }

            //get the new file
            jsonReader(
                pathToNewFile,
                ( err, data ) => {
        
                    const newData = data;
        
                    //file can't be retrieved errors
                    if( err ){
                        console.log( err );
                        updateLog( err, 'error' );
                        if( typeof callback === 'function' ){
                            callback( { status: 'error', error: err } );
                        }
                        return
                    }
        
                    /*
                        Run the merge rules
                        Loop through existing data, apply changes
                        - Comments get priority from existing data
                        - Hotspots and other metadata gets priority from the new data
                    */
                    for( let i in existingData ){
                        let oldSlide = existingData[i];

                        //find the corresponding slide in the new data
                        let newSlide = null;
                        for( let s in newData ){
                            s = newData[s];
                            if( s.id === oldSlide.id ){
                                newSlide = s;
                            }
                        }
                        //console.log( oldSlide, newSlide );

                        //if new data does not contain a match for this existing slide (meaning it was deleted)
                        //soft-delete from the existing data
                        if( newSlide === null ){
                            oldSlide.type = 'deleted';
                        }

                        //new data does contain this slide
                        //decide what changes to apply and ignore
                        else{

                            //id is absolute, can't be changed

                            //name shouldn't be changed either?

                            //if image changed apply the change
                            if( oldSlide.image !== newSlide.image ){
                                oldSlide.image = newSlide.image;
                            }

                            //drawer flag / info
                            //showing in drawer in new data
                            if( newSlide.showInDrawer === true ){
                                oldSlide.showInDrawer = newSlide.showInDrawer;
                                oldSlide.drawerInfo = newSlide.drawerInfo;
                            }
                            //was visible in new data but now is not.
                            if( newSlide.showInDrawer === false ){
                                oldSlide.showInDrawer = false;
                            }

                            /*
                                root hotspots
                                apply all changes
                                override the hotspot array in the old data with the hotspot array in the new data
                            */
                            if( typeof newSlide.hotspots !== 'undefined' ){
                                oldSlide.hotspots = newSlide.hotspots;
                            }

                            /*
                                root comments (not inside a scrollZone)
                                - If old slide and new slide both dont have comments, continune
                                - If old slide does not have comments and new slide does then just apply all the new comments
                                - If old slide has comments and new slide does not then keep all old comments
                                - If old slide has comments then loop through the new comments and compare to old comments and decide what changes to make
                            */
                            //determine if old or new data contains comments
                            let hasOldComments = false;
                            let hasNewComments = false;
                            if( typeof oldSlide.comments !== 'undefined' ){
                                if( oldSlide.comments.length > 0 ){
                                    hasOldComments = true;
                                }
                            }
                            if( typeof newSlide.comments !== 'undefined' ){
                                if( newSlide.comments.length > 0 ){
                                    hasNewComments = true;
                                }
                            }

                            //now run through cases
                            if(
                                hasOldComments === false &&
                                hasNewComments === false
                            ){
                                //no comments on either side
                                //do nothing
                            }
                            else if(
                                hasOldComments === false &&
                                hasNewComments === true
                            ){
                                //there are no old slide comments so push comments from the new data into the old
                                console.log( 'no old comments, adding new comments' );
                                oldSlide.comments = newSlide.comments;
                            }
                            else if(
                                hasOldComments === true &&
                                hasNewComments === false
                            ){
                                //old slide has comments, new slide doesn't
                                //do nothing
                            }
                            else{
                                //old slide and new slide have comments
                                //insert any new comments from new slide
                                //don't replace any comments that exist in old slide data

                                //loop through new comments. 
                                for( let c of newSlide.comments ){
                                    //see if there is a matching old comment
                                    let oldComment = oldSlide.comments.find( ( oldC ) => {
                                        return oldC.id === c.id;
                                    });

                                    //no matching old comment
                                    //add this new comment to the old comment array
                                    if( typeof oldComment === 'undefined' ){
                                        console.log( 'merging in a new comment', c );
                                        oldSlide.comments.push( c );
                                    }

                                    //else
                                    //old comment exists so don't do anything
                                }
                            }


                            /*
                                scrollZones
                                If scrollZone doesn't exist in old data but does in new data then add it
                                If scrollZone exists in old data then update hotspots but be careful about comments - follow same rules as root comments
                            */
                            //first check if new slide has any scrollZones
                            if( typeof newSlide.scrollZones !== 'undefined' && newSlide.scrollZones.length > 0 ){

                                for( let s of newSlide.scrollZones ){
                                
                                    //if old data does not have any scrollzones
                                    if( typeof oldSlide.scrollZones === 'undefined' ){
                                        oldSlide.scrollZones = newSlide.scrollZones;
                                    }

                                    //if old data has scrollZones
                                    else{

                                        //if old data scrollZones is an empty array then function like it does not have scrollZones and overwrite with the new data
                                        if( oldSlide.scrollZones.length < 1 ){
                                            oldSlide.scrollZones = newSlide.scrollZones;
                                        }

                                        //old scrollZones exist and aren't empty
                                        //loop through old scrollZones, see if any match this new scrollZone
                                        //if not, push this new scrollZone into the old data
                                        //if yes, make careful updates
                                        else{
                                            const oldScrollZone = oldSlide.scrollZones.find( ( oldS ) => {
                                                return oldS.id === s.id;
                                            });

                                            //didn't find a matching old scrollZone
                                            if( typeof oldScrollZone === 'undefined' ){
                                                console.log( 'adding new scrollzone', s );
                                                oldSlide.scrollZones.push( s );
                                            }

                                            //did find a matching old scrollZone
                                            else{

                                                /*
                                                    scrollZone hotspots
                                                    apply all changes
                                                    override the hotspot array in the old data with the hotspot array in the new data
                                                */
                                                if( typeof s.hotspots !== 'undefined' ){
                                                    oldScrollZone.hotspots = s.hotspots;
                                                }

                                                /*
                                                    scrollZone comments
                                                    - If old slide and new slide both dont have comments, continune
                                                    - If old slide does not have comments and new slide does then just apply all the new comments
                                                    - If old slide has comments and new slide does not then keep all old comments
                                                    - If old slide has comments then loop through the new comments and compare to old comments and decide what changes to make
                                                */
                                                //determine if old or new data contains comments
                                                let hasOldComments = false;
                                                let hasNewComments = false;
                                                if( typeof oldScrollZone.comments !== 'undefined' ){
                                                    if( oldScrollZone.comments.length > 0 ){
                                                        hasOldComments = true;
                                                    }
                                                }
                                                if( typeof s.comments !== 'undefined' ){
                                                    if( s.comments.length > 0 ){
                                                        hasNewComments = true;
                                                    }
                                                }

                                                //now run through cases
                                                if(
                                                    hasOldComments === false &&
                                                    hasNewComments === false
                                                ){
                                                    //no comments on either side
                                                    //do nothing
                                                }
                                                else if(
                                                    hasOldComments === false &&
                                                    hasNewComments === true
                                                ){
                                                    //there are no old slide comments so push comments from the new data into the old
                                                    oldScrollZone.comments = s.comments;
                                                }
                                                else if(
                                                    hasOldComments === true &&
                                                    hasNewComments === false
                                                ){
                                                    //old slide has comments, new slide doesn't
                                                    //do nothing
                                                }
                                                else{
                                                    //old slide and new slide have comments
                                                    //insert any new comments from new slide
                                                    //don't replace any comments that exist in old slide data

                                                    //loop through new comments. If there is not a corresponding comment in the old comments then add the new one.
                                                    for( let c of s.comments ){
                                                        //see if there is a matching old comment
                                                        let oldComment = oldScrollZone.comments.find( ( oldC ) => {
                                                            return oldC.id === c.id;
                                                        });

                                                        //no matching old comment
                                                        //add this new comment to the old comment array
                                                        if( typeof oldComment === 'undefined' ){
                                                            console.log( 'merging in a new comment', c );
                                                            oldScrollZone.comments.push( c );
                                                        }
                                                    }
                                                }


                                            }
                                        }

                                    }
    
                                }
                            }


                            //indicate that we've fully merged the new slide info
                            newSlide.mergeStatus = 'complete';
                        }


                        

                    }

                    /*
                        merge in any new slides
                        find any slides in newData that don't have mergeStatus = 'complete'
                        add that slide to the existing data
                    */
                    for( let s in newData ){
                        if( newData[s].mergeStatus !== 'complete' ){
                            console.log( 'adding new slide to existing data:', s );
                            existingData[ s ] = newData[ s ];
                        }
                    }


                    //save the existing data file to finalize the merge
                    fs.writeFile( existingFile, JSON.stringify( existingData ), err => {
                        if( err ){
                            console.log( 'Error writing file', err );
                            updateLog( err, 'error' );
                            if( typeof callback === 'function' ){
                                callback( { status: 'error', error: err } );
                            }
                            return;
                        } else {
                            console.log( 'Successfully merged files' );
                            updateLog( 'merge successful', 'success' );
                            if( typeof callback === 'function' ){
                                callback( { status: 'success' } );
                            }
                            return;
                        }
                    });
                }
            );

        }
    );
}


/*
    create a GUIID
*/
function createGuiID(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function( c ){
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

app.get(
    '/data/:type', (req, res) => {
        res.send(reload( `./public/data/${ req.params.type }.json` ) );
    }
);



//process data to convert to JSON
app.post(
    '/formatData', (req, res) => {

        const settings = req.body;

        console.log( settings );

        const file = `./public/data/${ settings.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    console.log( err );
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.message = 'file cannot be found';
                    result.error = err;
                    res.send( result );
                    return
                }

                console.log( data );

                //if global data file
                if( settings.file === 'global' ){
                    for( let hotspot in data ){
                        let h = data[ hotspot ];

                        if( typeof h.id === 'undefined' ){
                            h.id = createGuiID();
                        }
                    }
                }

                //if overlay file
                //overlays are their own context so they have nested slides
                else if( settings.file === 'overlay' ){

                    for( let overlay in data ){
                        let o = data[ overlay ];

                        o.name = overlay;

                        console.log( o );
                        for( let i of o.items ){
                            //slide data

                            //update id to be name instead
                            if( typeof i.id !== 'undefined' ){
                                i.name = i.id;
                                delete i.id;
                            }
                            

                            //add file reference since all other slides have it
                            i.file = 'overlay';
                            i.parent = o.name;

                            //update hotspots
                            if( typeof i.hotspots !== 'undefined' && i.hotspots.length > 0 ){
                                for( let h of i.hotspots ){
                                    if( h.type !== 'global' ){
                                        if( typeof h.id === 'undefined' ){
                                            h.id = createGuiID();
                                        }
                                        h.file = 'overlay';
                                        h.name = i.name;
                                        h.parent = o.name;
                                    }
                                }
                            }

                            //update comments
                            if( typeof i.comments !== 'undefined' &&  i.comments.length > 0 ){
                                for( let c of i.comments ){
                                    if( typeof c.id === 'undefined' ){
                                        c.id = createGuiID();
                                    }
                                    c.file = 'overlay';
                                    c.name = i.name;
                                }
                            }

                            //scrollzones
                            if( typeof i.scrollZones !== 'undefined' && i.scrollZones.length > 0 ){
                                for( let s of i.scrollZones ){
                                    //update hotspots
                                    if( typeof s.hotspots !== 'undefined' &&  s.hotspots.length > 0 ){
                                        for( let h of s.hotspots ){
                                            if( h.type !== 'global' ){
                                                if( typeof h.id === 'undefined' ){
                                                    h.id = createGuiID();
                                                }
                                                h.file = 'overlay';
                                                h.name = i.name;
                                                h.parent = o.name;
                                                h.scrollZone = s.id;
                                            }
                                        }
                                    }
            
                                    //update comments
                                    if( typeof s.comments !== 'undefined' &&  s.comments.length > 0 ){
                                        for( let c of s.comments ){
                                            if( typeof c.id === 'undefined' ){
                                                c.id = createGuiID();
                                            }
                                            c.file = 'overlay';
                                            c.name = i.name;
                                            c.parent = o.name;
                                            c.scrollZone = s.id;
                                        }
                                    }
                                }
                            }
                        }
                    }

                }

                //else follow the slide data model
                else{
                    //loop through the data and do stuff
                    for( let slide in data ){
                        let d = data[ slide ];

                        d.name = slide;

                        //slide data
                        if( typeof d.id === 'undefined' ){
                            d.id = createGuiID();
                        }

                        //update hotspots
                        if( typeof d.hotspots !== 'undefined' && d.hotspots.length > 0 ){
                            for( let h of d.hotspots ){
                                if( h.type !== 'global' ){
                                    if( typeof h.id === 'undefined' ){
                                        h.id = createGuiID();
                                    }
                                    h.file = settings.file;
                                    h.name = d.name;
                                }
                            }
                        }

                        //update comments
                        if( typeof d.comments !== 'undefined' &&  d.comments.length > 0 ){
                            for( let c of d.comments ){
                                if( typeof c.id === 'undefined' ){
                                    c.id = createGuiID();
                                }
                                c.file = settings.file;
                                c.name = d.name;
                            }
                        }

                        //scrollzones
                        if( typeof d.scrollZones !== 'undefined' && d.scrollZones.length > 0 ){
                            for( let s of d.scrollZones ){

                                //update hotspots
                                if( typeof s.hotspots !== 'undefined' &&  s.hotspots.length > 0 ){
                                    for( let h of s.hotspots ){
                                        if( h.type !== 'global' ){
                                            if( typeof h.id === 'undefined' ){
                                                h.id = createGuiID();
                                            }
                                            h.file = settings.file;
                                            h.name = d.name;
                                            h.scrollZone = s.id;
                                        }
                                    }
                                }
        
                                //update comments
                                if( typeof s.comments !== 'undefined' &&  s.comments.length > 0 ){
                                    for( let c of s.comments ){
                                        if( typeof c.id === 'undefined' ){
                                            c.id = createGuiID();
                                        }
                                        c.file = settings.file;
                                        c.name = d.name;
                                        c.scrollZone = s.id;
                                    }
                                }
                            }
                        }
                        
                    }
                    //end for loop
                }

                

                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err);
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file')
                        updateLog( 'successfully ran the format data function', 'success' );
                        result.status = 'successfully updated file';
                        res.send( result );
                    }
                })
            }
        );
    }
)

//authenticate a user
app.post(
    '/auth', (req, res) => {

        const settings = req.body;

        const file = `./public/data/passwords.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    result.status = 'error';
                    updateLog( err, 'error' );
                    result.error = err;
                    res.send( result );
                    return
                }

                //find the password for the given user id
                const pass = data.find( ( d ) => {
                    return d.id === settings.user
                } );
                if( typeof pass === 'undefined' ){
                    result.status = 'error';
                    result.error = 'could not find the password'
                    res.send( result );
                    return;
                }

                //console.log( settings.pass, pass.password );

                //check the user password against the user
                if( settings.pass === pass.password ){
                    result.status = 'success';
                    res.send( result );
                    return;
                }else{
                    result.status = 'error';
                    result.error = 'password did not match'
                    res.send( result );
                    return;
                }
                
            }
        );

    }
);

//add a new user to the users data
app.post(
    '/addUser', (req, res) => {

        const settings = req.body;

        const file = `./public/data/users.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.error = err;
                    res.send( result );
                    return
                }

                //see if the user is already listed in the DB
                let u = data.find( ( d ) => {
                    if(
                        d.first_name === settings.first_name &&
                        d.last_name === settings.last_name &&
                        d.company === settings.company
                    ){
                        return d;
                    }
                } );

                //found the user, return them
                if( typeof u !== 'undefined' ){
                    result.status = 'success';
                    result.user = u;
                    res.send( result );
                    return;
                }

                //did not find the user, create them then return
                else{
                    data.push( {
                        id: data.length + 1,
                        first_name: settings.first_name,
                        last_name: settings.last_name,
                        company: settings.company,
                        access: "view"
                    } );

                    u = data[ data.length - 1 ];

                    //update the file with the new data
                    fs.writeFile( file, JSON.stringify( data ), err => {
                        if (err) {
                            console.log('Error writing file', err)
                            updateLog( err, 'error' );
                            result.status = 'error';
                            result.error = err;
                            res.send( result );
                            return;
                        } else {
                            console.log('Successfully wrote file')
                            updateLog( 'successfully added user', 'success' );
                            result.status = 'successfully added user';
                            result.user = u;
                            res.send( result );

                            //create archive of the file
                            createArchive( 'users', data );
                            
                            return;
                        }
                    });
                }

            }
        );

    }
);

//add hotspot
app.post(
    '/add/hotspot', (req, res) => {

        const settings = req.body;
        const hotspotData = settings.data;

        const file = `./public/data/${ hotspotData.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( 'cannot retrieve file', 'error' );
                    result.status = 'error';
                    result.error = 'cannot retrieve the file';
                    res.send( result );
                    return
                }

                //find the form ( slide or scrollZone )
                let form = data[ hotspotData.name ];
                if( typeof form === 'undefined' ){
                    updateLog( `add comment ${ hotspotData.id }: could not find the form in the provided file`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the form in the provided file'
                    res.send( result );
                    return;
                }
                if( hotspotData.file === 'overlay' ){
                    form = form.items.find( (i) => {
                        return i.name === hotspotData.itemName;
                    });
                }
                if( typeof hotspotData.scrollZone !== 'undefined' ){
                    form = form.scrollZones.find( ( s ) => {
                        return s.id === hotspotData.scrollZone;
                    });
                }

                //find or create the hotspots array
                let hotspotsBucket = form.hotspots;
                if( typeof hotspotsBucket === 'undefined' ){
                    form.hotspots = [];
                    hotspotsBucket = form.hotspots;
                }

                console.log( form );


                //create the hotspots
                const newH = {
                    id: hotspotData.id,
                    type: hotspotData.type,
                    x: hotspotData.x,
                    y: hotspotData.y,
                    w: hotspotData.w,
                    h: hotspotData.h,
                    file: hotspotData.file,
                    name: hotspotData.name,
                    link: hotspotData.link
                }
                if( typeof hotspotData.scrollZone !== 'undefined' ){
                    newH.scrollZone = hotspotData.scrollZones;
                }
                if( hotspotData.file === 'overlay' ){
                    newH.name = hotspotData.itemName;
                    newH.parent = hotspotData.name;
                }
                hotspotsBucket.push( newH );

               
                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err)
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file')
                        updateLog( `sucessfully added comment: ${ hotspotData.id }`, 'success' );
                        result.status = 'successfully updated file';
                        res.send( result );

                        //create archive of the file
                        createArchive( hotspotData.file, data );
                    }
                });

                
            }
        );

    }
);

//add hotspot
app.post(
    '/add/globalHotspot', (req, res) => {

        const settings = req.body;
        const hotspotData = settings.data;

        console.log( settings );

        const file = `./public/data/${ settings.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( 'cannot retrieve file', 'error' );
                    result.status = 'error';
                    result.error = 'cannot retrieve the file';
                    res.send( result );
                    return
                }

                //find the form ( slide or scrollZone )
                let form = data[ settings.name ];
                if( typeof form === 'undefined' ){
                    updateLog( `add global hotspot ${ hotspotData.id }: could not find the form in the provided file`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the form in the provided file'
                    res.send( result );
                    return;
                }
                if( settings.file === 'overlay' ){
                    form = form.items.find( (i) => {
                        return i.name === hotspotData.itemName;
                    });
                }
                if( settings.scrollZone !== null ){
                    form = form.scrollZones.find( ( s ) => {
                        return s.id === settings.scrollZone;
                    });
                }

                //find or create the hotspots array
                let hotspotsBucket = form.hotspots;
                if( typeof hotspotsBucket === 'undefined' ){
                    form.hotspots = [];
                    hotspotsBucket = form.hotspots;
                }

                //create the hotspots
                const newH = { 
                    type: "global",
                    name: hotspotData.name
                }
                hotspotsBucket.push( newH );

               
                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err)
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file')
                        updateLog( `sucessfully added comment: ${ hotspotData.id }`, 'success' );
                        result.status = 'successfully updated file';
                        res.send( result );

                        //create archive of the file
                        createArchive( hotspotData.file, data );
                    }
                });

                
            }
        );

    }
);

//update hotspot
app.post(
    '/update/hotspot', (req, res) => {

        const settings = req.body;

        console.log( settings );

        const file = `./public/data/${ settings.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.error = err;
                    res.send( result );
                    return
                }

                let hotspot = null;

                //if global hotspot then the file structue is different
                if( settings.file === 'global' ){
                    //find the hotspot
                    hotspot = data[ settings.name ];

                    if( typeof hotspot === 'undefined' ){
                        updateLog( `update hotspot ${ settings.id }: could not find the hotspot on the node`, 'error' );
                        result.status = 'error';
                        result.error = 'could not find the hotspot in the data'
                        res.send( result );
                        return;
                    }
                }

                //for any other file type follow the slide data model.
                else{
                    //find the slide
                    let slide = settings.file === 'overlay' ? data[ settings.parent ] : data[ settings.name ];
                    if( typeof slide === 'undefined' ){
                        updateLog( `update hotspot ${ settings.id }: could not find the slide in the file`, 'error' );
                        result.status = 'error';
                        result.error = 'could not find the data node in the provided file'
                        res.send( result );
                        return;
                    }

                    //if overlay, find the item within the overlay
                    if( settings.file === 'overlay' ){
                        for( let i of slide.items ){
                            if( i.name === settings.name ){
                                slide = i;
                            }
                        }
                    }
                    

                    //find the hotspot
                    //first try within the slide
                    if( typeof slide.hotspots !== 'undefined' ){
                        hotspot = slide.hotspots.find( ( h ) => {
                            return h.id === settings.id;
                        });
                    }
                    //try within the scrollzone
                    if( typeof hotspot === 'undefined' && typeof slide.scrollZones !== 'undefined' ){
                        for( let s of slide.scrollZones ){
                            if( typeof s.hotspots !== 'undefined' ){
                                let h = s.hotspots.find( ( h ) => {
                                    return h.id === settings.id;
                                } );
                                if( typeof h !== 'undefined' ){
                                    hotspot = h;
                                    break;
                                }
                            }
                        }
                    }

                    //if still undefined then quit
                    if( typeof hotspot === 'undefined' ){
                        updateLog( `update hotspot ${ settings.id }: could not find the hotspot on the node`, 'error' );
                        result.status = 'error';
                        result.error = 'could not find the hotspot in the data'
                        res.send( result );
                        return;
                    }
                }

                //update the hotspot data
                hotspot.x = settings.x;
                hotspot.y = settings.y;
                hotspot.w = settings.w;
                hotspot.h = settings.h;
                hotspot.link = settings.link;
                hotspot.type = settings.type;

                if( typeof settings.state !== 'undefined' ){
                    hotspot.state = settings.state;
                }

                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err)
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file')
                        result.status = 'successfully updated file';
                        res.send( result );

                        updateLog( `succesfully updated hotspot ${ settings.id }`, 'success' );

                        //create archive of the file
                        createArchive( settings.file, data );
                        
                    }
                });

                
            }
        );

    }
);


//update hotspot
app.post(
    '/delete/globalHotspot', (req, res) => {

        const settings = req.body;

        console.log( settings );

        const file = `./public/data/${ settings.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.error = err;
                    res.send( result );
                    return
                }

                let hotspot = null;

                //find the slide
                let slide = settings.file === 'overlay' ? data[ settings.parent ] : data[ settings.name ];

                if( typeof slide === 'undefined' ){
                    updateLog( `update hotspot ${ settings.hotspotData.id }: could not find the slide in the file`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the data node in the provided file'
                    res.send( result );
                    return;
                }

                //if overlay, find the item within the overlay
                if( settings.file === 'overlay' ){
                    for( let i of slide.items ){
                        if( i.name === settings.name ){
                            slide = i;
                        }
                    }
                }
                

                //find the hotspot
                //first try within the slide
                if( typeof settings.scrollZone === 'undefined' ){
                    console.log( "don't look within scrollzones" );
                    if( typeof slide.hotspots !== 'undefined' ){
                        hotspot = slide.hotspots.find( ( h ) => {
                            return h.name === settings.hotspotData.name;
                        });
                    }
                }
                //try within the scrollzone
                else{
                    for( let s of slide.scrollZones ){

                        //only look within the scrollzone provided in the data, don't look in other scrollzones within this slide.
                        if( s.id === settings.scrollZone ){
                            if( typeof s.hotspots !== 'undefined' ){
                                let h = s.hotspots.find( ( h ) => {
                                    return h.name === settings.hotspotData.name;
                                } );
                                if( typeof h !== 'undefined' ){
                                    hotspot = h;
                                    break;
                                }
                            }
                        }
                        
                    }
                }

                //if still undefined then quit
                if( typeof hotspot === 'undefined' || hotspot === null ){
                    updateLog( `update hotspot ${ settings.hotspotData.id }: could not find the hotspot on the node`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the hotspot in the data'
                    res.send( result );
                    return;
                }

                console.log( hotspot );

                hotspot.state = 'deleted';


                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err)
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file')
                        result.status = 'successfully updated file';
                        res.send( result );

                        updateLog( `succesfully updated hotspot ${ settings.id }`, 'success' );

                        //create archive of the file
                        createArchive( settings.file, data );
                        
                    }
                });

                
            }
        );

    }
);


//add comment
app.post(
    '/add/comment', (req, res) => {

        const settings = req.body;
        const commentData = settings.data;

        console.log( commentData );

        const file = `./public/data/${ commentData.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.error = err;
                    res.send( result );
                    return
                }

                //find the form ( slide or scrollZone )
                let form = data[ commentData.name ];
                if( typeof form === 'undefined' ){
                    updateLog( `add comment ${ commentData.id }: could not find the form in the provided file`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the form in the provided file'
                    res.send( result );
                    return;
                }
                if( commentData.file === 'overlay' ){
                    form = form.items.find( (i) => {
                        return i.name === commentData.itemName;
                    });
                }
                
                if( typeof commentData.scrollZone !== 'undefined' ){
                    form = form.scrollZones.find( ( s ) => {
                        return s.id === commentData.scrollZone;
                    });
                }

                //find or create the comments array
                let commentsBucket = form.comments;
                if( typeof commentsBucket === 'undefined' ){
                    form.comments = [];
                    commentsBucket = form.comments;
                }

                //create the comment
                let newC = {
                    id: commentData.id,
                    type: commentData.type,
                    x: commentData.x,
                    y: commentData.y,
                    comment: commentData.comment.trim(),
                    user: commentData.user,
                    updatedOn: new Date(),
                    file: commentData.file,
                    name: commentData.name
                }
                if( typeof commentData.scrollZone !== 'undefined' ){
                    newC.scrollZone = commentData.scrollZone;
                }
                if( commentData.file === 'overlay' ){
                    newC.itemName = commentData.itemName;
                }


                commentsBucket.push( newC );

                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err)
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file')
                        updateLog( `sucessfully added comment: ${ commentData.id }`, 'success' );
                        result.status = 'successfully updated file';
                        res.send( result );

                        //create archive of the file
                        createArchive( commentData.file, data );
                    }
                });

                
            }
        );

    }
);

//update comment
app.post(
    '/update/comment', (req, res) => {

        const settings = req.body;
        const commentData = settings.data;

        console.log( commentData );

        const file = `./public/data/${ commentData.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.error = 'fetching the file failed';
                    res.send( result );
                    return
                }

    
                //find the form ( slide or scrollZone )
                let form = data[ commentData.name ];
                //check for some older data structure in some overlays
                if( commentData.file === 'overlay' ){
                    if( typeof form === 'undefined' ){
                        form = data[ commentData.parent ];
                    }
                }
                if( typeof form === 'undefined' ){
                    updateLog( `update comment ${ commentData.id }: could not find the form in the provided file`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the form in the provided file'
                    res.send( result );
                    return;
                }
                if( commentData.file === 'overlay' ){
                    form = form.items.find( (i) => {
                        if( i.name === commentData.itemName ){
                            return i;
                        }
                        //check for older data structure
                        if( i.name === commentData.name ){
                            return i;
                        }
                    });
                }
                
                if( typeof commentData.scrollZone !== 'undefined' ){
                    form = form.scrollZones.find( ( s ) => {
                        return s.id === commentData.scrollZone;
                    });
                }


                //find the comment
                let comment = null;
                //ideally we'll find the comment by ID, but ID will only be available for new or updated comments, not all existing ones
                comment = form.comments.find( ( c ) => {
                    return c.id === commentData.id
                } );

                //if still undefined then the commment doesn't exist
                //if this happens then exit
                if( comment === null || typeof comment === 'undefined' ){
                    updateLog( `update comment ${ commentData.id }: could not find the comment node in the form`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the comment node in the form'
                    res.send( result );
                    return;
                }
                
                //update the comment
                //comment.id = commentData.id; //can't update the id
                comment.x = commentData.x;
                comment.y = commentData.y;
                comment.comment = commentData.comment;
                comment.type = commentData.type;
                comment.user = commentData.user;
                comment.updatedOn = new Date();

                //console.log( 'new value of comment:', comment );

                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err);
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file');
                        updateLog( `successfully updated the comment ${ commentData.id }`, 'success' );
                        result.status = 'successfully updated file';
                        res.send( result );

                        //create archive of the file
                        createArchive( commentData.file, data );
                    }
                });
            }
        );

    }
);

//delete comment
app.post(
    '/delete/comment', (req, res) => {

        const settings = req.body;
        const commentData = settings.data;

        console.log( commentData );

        const file = `./public/data/${ commentData.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.error = err;
                    res.send( result );
                    return
                }

                //find the form
                //form will be either a slide or a scrollZone that is the direct parent of the comment
                let form = data[ commentData.name ];
                //check for some older data structure in some overlays
                if( commentData.file === 'overlay' ){
                    if( typeof form === 'undefined' ){
                        form = data[ commentData.parent ];
                    }
                }
                if( typeof form === 'undefined' ){
                    updateLog( `update comment ${ commentData.id }: could not find the form in the provided file`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the form in the provided file'
                    res.send( result );
                    return;
                }

                //if this is an overlay, find the slide within the overlay
                if( commentData.file === 'overlay' ){
                    form = form.items.find( (i) => {
                        if( i.name === commentData.itemName ){
                            return i;
                        }
                        //check for older data structure
                        if( i.name === commentData.name ){
                            return i;
                        }
                    });
                }
                
                if( typeof commentData.scrollZone !== 'undefined' ){
                    form = form.scrollZones.find( ( s ) => {
                        return s.id === commentData.scrollZone;
                    });
                }

                console.log( form );

                //find the comment
                let comment = null;
                //ideally we'll find the comment by ID, but ID will only be available for new or updated comments, not all existing ones
                comment = form.comments.find( ( c ) => {
                    return c.id === commentData.id
                } );

                //if still undefined then the commment doesn't exist
                //if this happens then exit
                if( comment === null ){
                    updateLog( `delete comment ${ commentData.id }: could not find the node in the form`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the node in the form'
                    res.send( result );
                    return;
                }

                comment.type = 'deleted';

                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err);
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file');
                        updateLog( `successfully deleted the comment ${ commentData.id }`, 'success' );
                        result.status = 'successfully updated file';
                        res.send( result );

                        //create archive of the file
                        createArchive( commentData.file, data );
                    }
                });

                
            }
        );

    }
);

//update status
app.post(
    '/update/status', (req, res) => {

        const settings = req.body;

        const file = `./public/data/${ settings.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.error = err;
                    res.send( result );
                    return
                }

                //find the form ( slide or scrollZone )
                let form = data[ settings.name ];
                if( typeof form === 'undefined' ){
                    updateLog( `update status ${ settings.name }`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the form in the provided file'
                    res.send( result );
                    return;
                }
                
                //update the slide status
                form.status = settings.status;

                //console.log( 'new value of status:', settings.status );

                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err);
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file');
                        updateLog( `successfully updated the status ${ settings.name }`, 'success' );
                        result.status = 'successfully updated file';
                        res.send( result );

                        //create archive of the file
                        createArchive( settings.file, data );
                    }
                });
            }
        );

    }
);

//update slide info
app.post(
    '/update/slide', (req, res) => {

        const settings = req.body;

        const file = `./public/data/${ settings.file }.json`;
        let result = {};
        
        //get the file
        jsonReader(
            file,
            ( err, data ) => {

                //file can't be retrieved errors
                if( err ){
                    updateLog( err, 'error' );
                    result.status = 'error';
                    result.error = err;
                    res.send( result );
                    return
                }

                //find the form ( slide or scrollZone )
                let form = data[ settings.name ];
                if( typeof form === 'undefined' ){
                    updateLog( `update slide ${ settings.name }`, 'error' );
                    result.status = 'error';
                    result.error = 'could not find the form in the provided file'
                    res.send( result );
                    return;
                }
                
                //update the slide stuff that can be changed here
                form.showInDrawer = settings.showInDrawer;

                //if changing from true to false then this data doesn't need to be updated because it's only uses if showInDrawer is true
                if( settings.showInDrawer === true ){
                    form. drawerInfo = {
                        "title": settings.drawerInfo.title,
                        "group": settings.file
                    };
                }

                //in the future we might add image updates and other slide changes


                //update the file with the new data
                fs.writeFile( file, JSON.stringify( data ), err => {
                    if (err) {
                        console.log('Error writing file', err);
                        updateLog( err, 'error' );
                        result.status = 'error';
                        result.error = err;
                        res.send( result );
                    } else {
                        console.log('Successfully wrote file');
                        updateLog( `successfully updated the slide ${ settings.name }`, 'success' );
                        result.status = 'successfully updated file';
                        res.send( result );

                        //create archive of the file
                        createArchive( settings.file, data );
                    }
                });
            }
        );

    }
);


/*
    Trigger the merge files request
    Typically the fs.watch below should automatically trigger this but doesn't look like it works consistently on the windows side.
    This function can be run from the c5_proto lib to manually trigger the merge
*/
app.post(
    '/mergeData', (req, res) => {

        const settings = req.body;
        let result = {};

        mergeFiles( settings.existingFile, settings.newFile, ( r ) => {
            if( r.status === 'error' ){
                result.status = 'error';
                result.error = r.error;
            }else{
                result.status = 'success';
            }
            res.send( result );
        } );

    }
);



/*
    start the server and listen for stuff
*/
app.listen(port, () => {
    console.log(`Example app listening on port ${port}!` );

    //watch for file changes in the data/merge folder in case we need to trigger a merge event
    const dir = './public/data/merge';
    fs.watch( dir, ( eventType, filename ) => {
        //console.log( eventType );
        // could be either 'rename' or 'change'. new file event and delete
        // also generally emit 'rename'
        //console.log( filename );

        if( eventType === 'rename' ){

            //now check if the file that changed exists or was deleted
            try {
                if( fs.existsSync( dir + '/' + filename ) ){
                    console.log( 'file exists' );

                    //check if file matches one of the existing data files
                    listDirectory( './public/data', ( fileList ) => {
                        for( let f of fileList ){
                            if( f === filename ){
                                mergeFiles( f, dir + '/' + filename );
                            }
                        }
                    });
                }else{
                    console.log( 'file no longer exists' );
                }
            }
            catch(err) {
                console.error(err)
            }
        }
        
        //if( filename ==)
     })
});

