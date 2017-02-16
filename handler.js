'use strict';

var AWS = require('aws-sdk');
var table = "BusData";
var request = require('request');
var parseJson = require('parse-json');
var url = 'https://rqato4w151.execute-api.us-west-1.amazonaws.com/dev/info';

AWS.config.update({
    region: "us-west-1"
});
var docClient = new AWS.DynamoDB.DocumentClient();

// Check if id exists and return index. Otherwise return -1.
function containsItem(uniqueArr, id) {
    //Asynchronous loop to compare ids.
    var seek = function (i, k, num) {
        if (uniqueArr[i].id == id) {
            return i;
        } else if ((i + 1) < k) {
            return seek((i + 1), k);
        } else {
            return -1;
        }
    }
    return seek(0, uniqueArr.length);
}

// Process table data and return it back in exactly task #1's form.
function stringify(jsonArr) {
        // Asynchronous loop to create reformat and create 1 json.
        var makeJSON = function(i, str, arr) {
            str += ("{\"id\":" + arr[i].id + ",\"logo\":\"" + arr[i].logo + "\",\"lat\":" + arr[i].lat + ",\"lng\":" + arr[i].lng + ",\"route\":" + arr[i].route + "}");
            if ((i + 1) < arr.length) {
                str += ",\n";
                return makeJSON((i + 1), str, arr);
            } else {
                str += "]";
                return str;
            }
        }

    return "[" + makeJSON(0, "", jsonArr);
}

// Attempt to put an item into the table.
function putItem(id, logo, lat, lng, route) {
    // Fill in the item's attributes here.
    var params = {
        TableName: table,
        Item: {
            "id": id,
            "timestamp": Date.now(),
            "logo": logo,
            "lat": lat,
            "lng": lng,
            "route": route
        }
    };

    docClient.put(params, function(err, data) {
        if (err) {
            console.error("Unable to put. Error:", JSON.stringify(err, null, 2));
        } else {
            console.log("Put succeeded.");
        }
    });
}

// Attempt to grab the JSON from url. Then input them as items to dynamoDB.
function putMultipleItems() {
    request(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            // Parse the page response as JSON array
            var jsonArr = parseJson(body);
            // Asynchronous loop to put each item in.
            var create = function(i, k) {
                var vals = jsonArr[i];
                putItem(vals.id, vals.logo, vals.lat, vals.lng, vals.route);
                if ((i + 1) < k) {
                    create((i + 1), k);
                }
            }
            create(0, jsonArr.length);
        }
    })
}

// Scan and get entire table of items. Then return JSON.
var scanAndJSON = function(callback) {
    var params = {
        TableName: table
    };
    docClient.scan(params, function(err, data) {
        if (err) {
            console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
            if (callback) {
                const responseErr = {
                    statusCode: 500,
                    body: JSON.stringify({
                        'err': err
                    }),
                };
                callback(null, responseErr);
            }
        } else {
            var jsonArr = data.Items;
            var uniqueArr = [];

            // Get only the most up to date elements.
            var getRecentItems = function (i, arr, jsArr) {
                if (arr.length != 0) {
                    // index is the item's index or -1 for missing.
                    var index = containsItem(arr, jsArr[i].id);
                    if (index > -1) {
                        // Replace item with newest timestamp one.
                        if (arr[index].timestamp < jsArr[i].timestamp) {
                            arr[index] = jsArr[i];
                        }
                    } else {
                        // If Id doesn't exist in already, Put in.
                        arr.push(jsArr[i]);
                    }
                } else {
                    // Empty arr, Put in first item.
                    arr.push(jsArr[i]);
                }

                if ((i + 1) < jsArr.length) {
                    getRecentItems((i + 1), arr, jsArr);
                }
            }

            getRecentItems(0, uniqueArr, jsonArr);
            
            //Stringify all json arrays into 1 json. Ignores timestamp.
            if (callback) {
                const responseOk = {
                    statusCode: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: stringify(uniqueArr)
                };
                return callback(null, responseOk);
            }
        }
    });
    return callback;
}

//HTTP GET - Test link
module.exports.hello = (event, context, callback) => {
    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
            message: 'Healthy function!'
        }),
    };
    callback(null, response);
};

//HTTP GET - Populates DynamoDB table with new data.
module.exports.retrieve = (event, context, callback) => {
    putMultipleItems();
    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
            message: ('BusData successfully updated on Time = ' + Date.now())
        }),
    };
    callback(null, response);
};

//HTTP GET - Returns JSON of newest data.
module.exports.getdata = (event, context, callback) => {
    scanAndJSON(callback);
};
