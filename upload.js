//自定义参数区
var basePath='/tmp';//上传的根路径
var tempPath='/tmp';
var redis_ip='127.0.0.1';
var redis_port=11000;
var redis_dbindex=5;

//系统说明：
//POST的时候，系统一定要传递的参数有 url,path,key,db_index
//GET的时候.del=filepath,path格式/123/23/23/sdf.jpg   .需要传递del,key,dbindex

//----系统定义区
var http = require('http');
var fs=require('fs');
var ps=require('path');
var formidable = require('formidable');
var util=require('util');
var redis = require('redis');
var querystring=require('querystring');
var server;


server = http.createServer(function(req, res) {

if (req.method=='POST') {
	var form = new formidable.IncomingForm(),
	files = new Array(),
	File=null,
	fields = new Array();
	form.uploadDir = tempPath;
	form.encoding='utf-8';
	form.maxFieldsSize=5*1024*1024;
	form.keepExtensions=false;
	form.on('field', function(field, value) {
		try{
		fields[field]=value;
		}
		catch(e)
		{			
			writefalse(res,e,'onfield error');
		}
		
	})
	.on('file', function(field, file) {
		try{
		files[field]=file;
		File=file;
		}
		catch(e)
		{
			
			writefalse(res,e,'onfile error!');
		}
	})
	.on('end', function() {
	
		 try{		
				if(fields['url'] && fields['path']&& File.size>0)
				{
					
					if(fields['filesize'] && File.size>fields['filesize'])
					{
						fs.unlink(File.path,function(err){});
						writefalse(res,'','文件大小超过限制！');
						
					}
					else
					{
						var descPath=basePath+fields['path'];
						
						mkdirs(descPath,0755,function(){
						var rnd=generateMixed(6);
						var filename=rnd+File.name.substr(File.name.lastIndexOf('.'));
						fs.rename(File.path, descPath+'/'+filename, function(err){   console.log(err+'');});	
						writeRedisList(fields,filename);
												  });
						res.writeHead(302,{'Location':fields['url']});
						res.end('0');
					}
				}
				else
				{
					
					writefalse(res,'','需要传入跳转url，path!');
				}
			}
			catch(e)
			{
				//console.log(e);
				writefalse(res,e,'上传事件出错！');                                                                                                                                                                                                                                                                                                                   
			}
	}).on('error',function(err){
			//console.log(err+'');
			writefalse(res,err,'上传文件出错!');
		});
	

	try
	{
		form.parse(req);
		
	}
	catch(e)
	{
		//console.log(e);
		writefalse(res,e,'form.parse error');
	}

} 
else if(req.method=='GET')
{
	try
	{
		var para=querystring.parse(req.url.replace('/?',''));
	
		if(para.del && para.key)
		{
			//删除文件
			var path=basePath+para.del;
			fs.unlink(path, function(err){});
			
			//删除redis
			delItemFromRedisList(para.key,para.del,para.dbindex);
			
			writefalse(res,'','1');	
			
		}
		
	
	}
	catch(e)
	{
		writefalse(res,e,'GET 错误！');
	}
}

else {
	res.writeHead(404, {'content-type': 'text/html;charset=utf-8'});
	res.end('0');
}
});
server.listen(8888);

console.log('listening on http://localhost:'+8888+'/');

function writefalse(res,e,msg)
{
	
	res.writeHead(200, {'content-type': 'text/html;charset=utf-8'});
	if(msg){
	res.end(msg);
	}
	else
	res.end('0');
	console.log(''+e);
	
}
//写入redis  List形式的
function writeRedisList(fields,filename)
{
	try
	{
	
	//循环获取传过来的参数，找到redis 相关的。
		   var redisClient = redis.createClient(redis_port,redis_ip);
				   redisClient.on("error", function (err) {
						console.log("Error " + err);
						return false;
			});
			
			if(fields['key'])
			{
				
				var json='{';
				for(var s  in fields)
				{
					if(s.indexOf('redis_')==0 )
					{
						json +='\''+s.substr(6)+'\':\''+fields[s]+'\',';
					}
				}
								
				 //console.log('filename:'+filename);
				if(fields['path'] && filename)
				{
					json +='\'Path\':\''+fields['path']+filename+'\',';
				}
				if(json.length>1)
					json=json.substr(0,json.length-1);
				json += '}';
				if(fields['db_index'])
				redis_dbindex=fields['db_index'];
				redisClient.select(redis_dbindex,function(){
																redisClient.rpush(fields['key'], json, function(){
																	redisClient.quit();
																});										  
														  
														  });
				
			}			 
			
			return true;
	}
	catch(e)
	{
		console.log('redis error:'+e);
		return false;
	}
	
}

//从redis里删除
function delItemFromRedisList(key,path,dbindex)
{
	try
	{
	
	//循环获取传过来的参数，找到redis 相关的。
		   var redisClient = redis.createClient(redis_port,redis_ip);
				   redisClient.on("error", function (err) {
						console.log("Error " + err);
						return false;
			});
			
			if(key&&path)
			{		
				
				if(dbindex)
				redis_dbindex=dbindex;
				redisClient.select(redis_dbindex,function(){
						redisClient.lrange(key, 0,-1, function (err, replies){
						replies.forEach(function (reply, i) {
							console.log("    " + i + ": " + reply);
							if(reply.indexOf(path)>-1)
							{
								redisClient.lrem(key,0,reply,function(){
																	  redisClient.quit();
																	  });
							}
						});
							
						
					});										  
														  
				});
				
			}			 
			
			return true;
	}
	catch(e)
	{
		console.log('redis error:'+e);
		return false;
	}
	
}
//获取N 个随机字符 
function generateMixed(n) {
var jschars = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
    var res = "";
    for(var i = 0; i < n ; i ++) {
        var id = Math.ceil(Math.random()*35);
        res += jschars[id];
    }
    return res;
} 
//定义创建目录方法
var mkdirs = module.exports.mkdirs = function(dirpath, mode, callback) {
    ps.exists(dirpath, function(exists) {
        if(exists) {
                callback(dirpath);
        } else {
                //尝试创建父目录，然后再创建当前目录
                mkdirs(ps.dirname(dirpath), mode, function(){
                        fs.mkdir(dirpath, mode, callback);
                });
        }
    });
};