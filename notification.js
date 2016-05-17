var cntr = require('./controller.js');
var uuid = require('node-uuid');
// Generate a v1 (time-based) id

var module = 'notification';
exports.sendWelcomeEmail =function (to,fname,callback){
	var data = {};
	data.requestId = uuid.v1();
	data.module = module;
	data.entityName = 'wf-send-email';
	//data.calltype = 'workflow';
	data.parameter={};
	data.parameter.template = "WelcomeEmail";
	data.parameter.To = to;
	if(!fname) {
		fname = to;
	}
	data.parameter['sub.-firstname-'] = fname;

console.dir(data);

  cntr.callWorkflow(data,function(res){
  //// operations on call back
  callback(res);
	});
};
