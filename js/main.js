var map;
var firstRun = true;
var parsedData;
var coords = [];
var url;
var parsedData;

$(document).ready(function() {

	// Check to see if the app is running for the first time. If so, show the first run overlay.
    if (localStorage.getItem('firstRun') != 'false') {
        $('#firstOverlay').show();
        localStorage.setItem('firstRun', 'false');
    }

	// Clear the search box (in case the value was saved across sessions).
    $('#textSearch').val('');

	// Load up Mapbox GL - access token and the main map element.
	// The default style is a plain white one. 
	// Note: If you're rolling your own HereStory instance, you'll need to change the token and style.
	mapboxgl.accessToken = mbToken;
	map = new mapboxgl.Map({
		container: 'map', // container id
		style: mbStyle,
		zoom: 16 // starting zoom
	});

	// Add zoom and orientation controls to top right corner of the map.
    map.addControl(new mapboxgl.NavigationControl());

    // Here, we're executing a few things once the map is loaded.
	map.on('load', function () {

		/* See if the user wants to load the map with certain points loaded, either a hashtag or story.
			Format:
				By hashtag: ?searchtype=tag&value=<hashtag>
				By story: ?searchtype=story&value=<story>
			Reference for substring:
				http://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters
		*/
        var params = location.search.substring(1);
        url = 'db_scripts/viewPoints.php';
		
		// If there are parameters, add this to the request to the viewPoints script.
        if (params.length > 0) {
            url = 'db_scripts/viewPoints.php?' + params;
        }
        
		// Get the stories based on the base URL constructed above.
        var gjPoints = $.get(url).done(function(data) {

			// Parse the data from the viewPoints script (returned as GeoJSON)

            // JSON-ify the data returned from the GET request.
            parsedData = JSON.parse(data);

            // Add the data to the source.
            map.addSource('pointSource', {
                'type': 'geojson',
                'data': parsedData
            });

            // Add the source above as a layer.
            map.addLayer({
                'id': 'pointsLoc',
                'type': 'symbol',
                'source': 'pointSource',
                'layout': {
                    'icon-image': '{icon}-15'
                }
            });

            // Get the current position and call the success handler.
            /* NOTE: There is an assumption that Geolocation is working.
			   Possible help dialog? See below.
                - It's possible that geolocation won't work if LocationServices (iOS and Android) are off.
				- iOS: Settings > Privacy > Location Services [needs to be on] > Safari Websites > While Using
				- Android: Settings > Location [needs to be on]
					- Chrome: go to the site > click green lock icon > Site Settings > click Location if it is set to Block and change to Allow.
            */
            navigator.geolocation.getCurrentPosition(centreMap);
        });
	});

	// This adds a popup if the current location point clicked.
	/*map.on('click', 'curLoc', function (e) {
        new mapboxgl.Popup()
            .setLngLat(e.features[0].geometry.coordinates)
            .setHTML(e.features[0].properties.description)
            .addTo(map);
    });*/

	// Click handler for the points available on the map.
    map.on('click', 'pointsLoc', function (e) {

        // This holds the img name for the points as the sidebar needs to be changed if there is an image.
		// While this is true of all points, the image element needs to be hidden if there is no image.
        var img = e.features[0].properties.img;
        if (img === "") {
			// The following line is there in case it would be better to have a "no image" placeholder instead of hiding the image element in its entirety.
            //$('#imgStory').attr('src', 'img/nopic.png');
			// The following two lines hide the image element itself and the corner link that "expands" the image.
            $('#imgStory').hide();
            $('#iconExpand').hide();
        } else {
            $('#imgStory').show();
            $('#iconExpand').show();
			// Change the image element and the expand link to the value of the story (img variable).
            $('#imgStory').attr('src', 'images/' + img);
            $('#iconExpand').attr('href', 'images/' + img);
        }
		// Set the description and tag labels (element) to the appropriate values from the clicked point.
        $('#descLabel').html(e.features[0].properties.description + '<p></p><br \\>Date: ' + e.features[0].properties.date);
        $('#tagLabel').html('<i class="hashtag icon"></i>' + e.features[0].properties.tag);
		// Show the menu.
        toggleMenu();
    });

	// This is hear in case we want to implement "click place to add story" functionality.
    // Source: https://www.mapbox.com/mapbox-gl-js/example/mouse-position/
    /*map.on('click', function(e) {
        $('#textLocation').val(String(e.lngLat.lat) + ', ' + String(e.lngLat.lng));
        showAdd();
    })*/

	// This checks to see if enter is pressed (KeyboardEvent value 13) and if so, get the value of the text input and pass that to the "getPoints()" method.
    $("#textSearch").on("keydown", function(e) {
		// Get the keycode value and check to see if it's 13 (KeyboardEvent value for enter).
		if (e.keyCode === 13) {
			// "Blur" is equivalent to losing focus which moves the cursor out of the text input.
			$("#textSearch").blur();
			var textValue = $("#textSearch").val();
			// Get all the points and pass the value of the text input.
			// The second value is whether or not to zoom in on the points. This is helpful for searches
			// to fit all of them into the viewport.
            getPoints(textValue, true);
		}
	});
});

/* This function gets the points and plots them on the map.
    Parameters:
        - term: The search criteria. If this is blank, all points are loaded.
        - zoom: If true, zoom in on the points returned.
*/
function getPoints(term, zoom) {

    // This houses the request URL.
    var url;
    
    // If the term is undefined or empty, set the request url to the script without parameters.
    // If there is a a term, parse it and add it to the request URL.
    if (term === undefined || term === '') {
        url = 'db_scripts/viewPoints.php';
    } else {
        // If the first character is a pound sign, the user is searching for a theme so get every character after that and then create a URL based on that.
        if (term.charAt(0) == '#') {
            url = 'db_scripts/viewPoints.php?searchtype=tag&value=' + term.substr(term.indexOf("#") + 1);
        } else {
            url = 'db_scripts/viewPoints.php?searchtype=story&value=' + term;
        }
    }

    // Change the icon on the load all button from the refresh icon to the spinning/loading icon.
    $('#refreshButtonIcon').removeClass('refresh');
    $('#refreshButtonIcon').addClass('asterisk loading');

    // The main GET request. It's synchronous for now as a way of accommodating the increasingly large dataset.
    // This will need to be improved but for now, this works.
    var gjPoints = $.get(url, {async: false}).done(function(data) {

        // This block gets the pointSource (see document load) and sets the data to the points gathered in the gjPoints GET request.
        // Source: https://www.mapbox.com/mapbox-gl-js/example/live-geojson/
        $.when(map.getSource('pointSource').setData(JSON.parse(data))).then(function() {
            // Set the icon back to the original refresh icon from the spinning/loading icon.
            $('#refreshButtonIcon').removeClass('asterisk loading');
            $('#refreshButtonIcon').addClass('refresh');
        });

        // If the term is not undefined or empty, the user has requested a subset of the data.
        // This block sets up an array that contains the points so that the map is bounded by the points.
        if (term !== undefined || term !== '') {
            parsedData = JSON.parse(data);
            // This loop adds all the points to the coords array.
            for (var x in data) {
                try {
                    var lng = parseFloat(parsedData.features[x].geometry.coordinates[0]);
                    var lat = parseFloat(parsedData.features[x].geometry.coordinates[1]);
                    coords.push([lng, lat]);
                } catch(e) {}
            }

            // Set the bounds of the map to the coordinates in the coords array.
            // Here, the southwest and northeast corners.
            // Source: https://www.mapbox.com/mapbox-gl-js/example/zoomto-linestring/
            var bounds = coords.reduce(function (bounds, coord) {
                return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coords[0], coords[0]));

            // If the zoom parameter is true, zoom in on the bouns set up above.
            if (zoom === true) {
                map.fitBounds(bounds, {
                    padding: 30
                });
            }
            
            // Empty the coors variable for the next search.
            coords = [];
        } else {
            // If the term isn't set (and thus all points are being loaded), centre the map on the user's location.
            navigator.geolocation.getCurrentPosition(centreMap);
        }
        // Clear the search box.
        $('#textSearch').val('');
    });
}

// This is the main geolocation handler.
function centreMap(position) {

    var lat = position.coords.latitude;
    var lng = position.coords.longitude;

    // Centre the map on the latitude and longitude.
    map.setCenter([lng, lat]);
	
    // Set the location input on the add form. This needs to be there so the value is included with the request to add a point.
    $("#textLocation").val(parseFloat(lat).toFixed(7) + ", " + parseFloat(lng).toFixed(7));


    // If this is the first run of the app (for the session), create and add the source and layer that will store the lat and lng of the user's location.
    if (firstRun === true) {

        // Add the current location source.
        map.addSource('curSource', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': [{
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [lng, lat]
                    },
                    'properties': {
                        'description': '<br \\>Your Current Location',
                        'icon': 'circle-stroked'
                    }
                }]
            }
        });

        // Add the layer with the current location source.
        map.addLayer({
            'id': 'curLoc',
            'type': 'symbol',
            'source': 'curSource',
            'layout': {
                'icon-image': '{icon}-15'
            }
        });

        // Set firstRun to false since we don't need to keep adding the source and layer (we just change it).
        firstRun = false;

    } else {
        // If we've already added the source and layer (ie. the session has already been established), simply change the data in the source.
        map.getSource('curSource').setData(JSON.parse({
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [position.coords.longitude, position.coords.latitude]
                },
                'properties': {
                    'description': '<br \\>Your Current Location',
                    'icon': 'circle-stroked'
                }
            }]
        }));
    }

    // If the url for the GET request is set to a search result of some kind (by tag or story), set the bounds of the map to those points and the user's location.
    if (url != 'db_scripts/viewPoints.php') {
        // http://stackoverflow.com/a/35715102
        var bounds = new mapboxgl.LngLatBounds();
        parsedData.features.forEach(function(feature) {
            bounds.extend(feature.geometry.coordinates);
        });

        // Set the view on the map to the bounds of the points and provide some padding around them.
        map.fitBounds(bounds, {
            padding: 30
        });   
    } else {
        // Zoom in on where the user is.
        map.setZoom(16);
    }

    /* -------------------------
    TO-DO HERE - ADD DIALOG THAT ASKS PEOPLE TO WAIT WHILE POINTS ARE LOADED.
    HERE, THE DIALOG WOULD BE HIDDEN.
    ------------------------- */

    // Return the location of the user.
    return [lng, lat];
}

// Toggle the side menu that contains the points info including story and tag info and picture (if applicable).
function toggleMenu() {
    // Set the sidebar to overlay the map (the other option is to push the map to the side but that takes away space on smaller screens).
    $('#sideBar')
        .sidebar('setting', 'transition', 'overlay')
        .sidebar('setting', 'mobileTransition', 'overlay')
        .sidebar('toggle');
}

// Toggle the side menu that contains the points info including story and tag info and picture (if applicable).
function toggleOpts() {
    // Set the sidebar to overlay the map (the other option is to push the map to the side but that takes away space on smaller screens).
    $('#menuBar')
        .sidebar('setting', 'transition', 'overlay')
        .sidebar('setting', 'mobileTransition', 'overlay')
        .sidebar('toggle');
}

// Close the add overlay.
function closeAdd() {
    $('#addOverlay').hide();
    //$('#addOverlay').fadeOut('slow');
}

// Close the "first" overlay (the overlay that appears the very first time a user uses HereStory).
function closeFirst() {
    $('#firstOverlay').hide();
}

// Show the add overlay.
function showAdd() {
    // Here, the map is centred on the user.
    // This is a bit of a workaround to ensure that the location input (#textLocation) has the right value.
    navigator.geolocation.getCurrentPosition(centreMapToolbar);
    $('#addOverlay').show();
    //$('#addOverlay').fadeIn('slow');
}

// Show the overlay upload that asks users to wait while a story is uploaded. This is more for circumstances where the user is uploading a picture and thus, the submission of a story may take some time.
function showUploadProgress() {
    $('#uploadOverlay').show();
}

// Close the upload progress dialog.
function closeUploadProgress() {
    $('#uploadOverlay').hide();
}

// This is the click handler for the location button (when the user wants to recentre the map).
function reCentreMap() {
    // Change the icon on the toolbar button to a spinning/loading icon.
    $('#centerLocButtonIcon').removeClass('location arrow');
    $('#centerLocButtonIcon').addClass('asterisk loading');
    // Call the handler for the geolocation.
	navigator.geolocation.getCurrentPosition(centreMapToolbar);
}

// The geolocation handler for requests to recentre the map by the user.
function centreMapToolbar(position) {

    var lat = position.coords.latitude;
    var lng = position.coords.longitude;

    /*map.getSource('curSource').setData(JSON.parse({
        'type': 'FeatureCollection',
        'features': [{
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [position.coords.longitude, position.coords.latitude]
            },
            'properties': {
                'description': '<br \\>Your Current Location',
                'icon': 'circle-stroked'
            }
        }]
    }));*/

    map.getSource('curSource').setData({
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat]
            },
            "properties": {
                "description": "Null Island",
                'icon': 'circle-stroked'
            }
        }]
    });

    // This sets the location of the #textLocation input to the coordinates of the user.
    $("#textLocation").val(parseFloat(lat).toFixed(7) + ", " + parseFloat(lng).toFixed(7));
    // Fly to the user's location.
    map.flyTo({
        center: [lng, lat]
    });
    //map.setZoom(16);
    // Change the icon on the location toolbar button back to the location arrow from the spinning/loading icon.
    $('#centerLocButtonIcon').removeClass('asterisk loading');
    $('#centerLocButtonIcon').addClass('location arrow');
}

// This function is responsible for submitting the story - passing the data to the addStory script.
function submitStory() {
    // Show the upload progress dialog.
    showUploadProgress();
    // Get the story data.
    var storyData = new FormData($("#formStory")[0]);
    // Send a POST request with the data from the add story overlay.
    $.ajax({
		type: "POST",
		url: "db_scripts/addStory.php",
		data: storyData,
		complete: function(data) {
            // Close the add overlay.
            closeAdd();
            // Close the upload overlay.
            closeUploadProgress();
            // Reset the form.
            document.getElementById('formStory').reset();
            // Get all the points.
            getPoints('');
        },
        success: function(data) {
            // Close the add overlay.
            closeAdd();
            // Close the upload overlay.
            closeUploadProgress();
            // Reset the form.
            document.getElementById('formStory').reset();
            // Get all the points.
            getPoints('');
        },
		cache: false,
		contentType: false,
		processData: false
    });
}