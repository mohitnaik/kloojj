var rp = require('requestprocessor');
var requester = [];
requester['notification'] = new rp('req',"tcp://localhost","4001").socket;

var responder = new rp('rep',"tcp://127.0.0.1","4411").socket;
var requestPool = new Array();
var events = require('events');
var eventEmitter = new events.EventEmitter();

//module.exports.taxonomy   = require('./taxonomy.js');
//module.exports.sharing   = require('./sharing.js');
module.exports.notification   = require('./notification.js');

exports.callWorkflow =function (data,callback) {
  data.calltype = 'workflow';
  requester[data.module].send(JSON.stringify(data));
  var req = { 'Id' : data.requestId, 'fun' : callback};
  requestPool.push(req);
  console.dir(requestPool);
}

onResponse = function (data,callback) {

}

requester['notification'].on("message",function(data) {
  //var response = JSON.parse(data);
  console.log("response recived");
  console.dir(data);
});

function findarry(nameKey, myArray){
    for (var i=0; i < myArray.length; i++) {
        if (myArray[i].Id === nameKey) {
            return myArray[i];
        }
    }
}

var removeByAttr = function(arr, attr, value){
    var i = arr.length;
    while(i--){
       if( arr[i]
           && arr[i].hasOwnProperty(attr)
           && (arguments.length > 2 && arr[i][attr] === value ) ){

           arr.splice(i,1);

       }
    }
    return arr;
}

function raisCallback(fn,data) {
  fn(data);
}

responder.on("message",function(data) {
  var response = JSON.parse(data);
  console.log("request recived");
  var str = "'"+response.requestId + "',";
  if(response != null && response.fname != null && response.fname != 'undefined') {
    for (var index in response.parameter) {
      str = str +"'" +response.parameter[index] + "',";
    }
  //tx[response.fname](response);
  str = str.substring(0,str.length-1);
  var func = "tx['"+response.fname+"']("+ str + ")";
  console.log(func);
  eval(func);
  }
  else if(response != null && response.status != null && response.status != 'undefined' && response.requestId != null && response.requestId != 'undefined') {
        console.log('Got it');
	var resultObject = findarry(response.requestId,requestPool);
         //console.dir(resultObject);
        if(resultObject != null && resultObject != 'undefined') {
          removeByAttr(requestPool,'Id',response.requestId);
          raisCallback(resultObject.fun,response);
        }
  }
  responder.send('ok');
});
