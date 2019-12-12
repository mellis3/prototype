//this should be a JSON file but JSON doesn't like comments

const data = {

    //slide
    //top level item within the prototype
    //can be at the highest level as a stand-alone slide or within an overlay
    "issue_owner": {

        //Unique ID / GUIID - not currently used but storing in case it's easier to find data in the future.
        "id": "3ce66314-52cb-4681-b850-9c256238b2d2", 

        //name of the slide
        //should match the object Key
        "name": "issue_owner", 

        //path to the image to display in the slide
        //prototype assumes all images are inside public/img folder
        "img": "issue/owner.jpg", 

        //array of hotspots
        //can include global hotspots and unique hotspots
        //hotspots can also be within a scrollZone and will follow the same structure
        "hotspots": [

            //global hotspot
            //defined in the global.json file
            {
                "type": "global",
                "name": "backToIssueDashboard"
            },

            //unique hotspot
            {
                "id": "5440838c-0d46-4422-a209-c00b38cc1eb7",
                "x": 274, //number (not px)
                "y": 164,
                "w": 200,
                "h": 38,
                "link": "issue_info", //name of slide to go to - assumes this slide is within the same JSON file
                "file": "issue", //same JSON file. front-end uses this as an attribute to know where to look for the hotspot when updating hotspot data.
                "name": "issue_owner", //slide name
                "scrollZone": "issue_form0" //if within a scrollZone - otherwise this prop doesn't exist.
            }

        ],


        //array of comments
        //comments can be here on the slide or within a scrollZone and will follow the same structure.
        "comments": [

            {
                "id": "3034e57a-2e39-4360-bcfb-34df97e579e9",
                "type": "logic", //options are Logic, Notification, Note, Question, Design Note
                "x": 400, //number (not px)
                "y": 80,

                //string version of the comment, no formatting
                "comment": "If site === Y12 assign To-Do to Seth Bowman. If site === Pantex assign to Darla. Get site from parent object site. If no site can be derived from parent then assign to-do to both.",

                //formatted version of the comment using the QuillJS editing engine,
                "quill": {
                    "ops": [{
                        "insert": "If site === Y12 assign To-Do to Seth Bowman. If site === Pantex assign to Darla. Get site from parent object site. If no site can be derived from parent then assign to-do to both.\n"
                    }]
                },
                
                //information about where to find the comment in the data, used when trying to update the comment - might be able to improve this by using the GUIID to find the comment.
                "file": "issue",
                "name": "issue_owner",
                "scrollZone": "issue_form0",

                //information about who updated the comment and when
                "user": "1",
                "updatedOn": "2019-12-03T15:22:56.733Z",
            }

        ],

        //scrollZones
        //these are like nested slides within the main slide that have overflow: scroll set on them
        //as many objects as needed following this pattern
        "scrollZones": [{

            //id here is the same as Name on the slide - this inconsistency should probably be fixed
            "id": "issue_form0",

            //position and size
            "x": 537,
            "y": 100,
            "w": 500,
            "h": 603,

            //image
            //assuming public/img as the location
            "img": "issue/_forms/form0_issueOwner.jpg",

            //max with of the image, will automatically center the image horizontally within the scrollzone
            "maxImgWidth": 450,

            //array of layers that are static within the scrollZone
            //they don't scroll with the scrollzone but sit on top.
            //as many objects as needed following this pattern
            "layers":[
                {
                    "x":418,
                    "y":522,
                    "w":54,
                    "h":54,
                    "img":"document_new_FAB.png",

                    //hotspots array within the layer
                    //see hotspots above for data structure
                    "hotspots":[]
                }
            ],

            //array of hotspots within the scrollZone
            //see hotspots above for data structure
            "hotspots": [],

            //array of comments within the scrollZone
            //see comments above for data structure
            "comments": []
        }]
    }
}