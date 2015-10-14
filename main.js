var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');
var Random = require('random-js');

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["subject.js"];
	}
	var filePath = args[0];

	constraints(filePath);

	generateTestCases()

}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue( greaterThan, constraintValue )
{
	if( greaterThan )
		return Random.integer(constraintValue,constraintValue+10)(engine);
	else
		return Random.integer(constraintValue-10,constraintValue)(engine);
}

function Constraint(properties)
{
	this.ident = properties.ident;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.funcName = properties.funcName;
	// Supported kinds: "fileWithContent","fileExists"
	// integer, string, phoneNumber
	this.kind = properties.kind;
}

function fakeDemo()
{
	console.log( faker.phone.phoneNumber() );
	console.log( faker.phone.phoneNumberFormat() );
	console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary = 
{
	pathExists:
	{
		'path/fileExists': {}
	},
	fileWithContent:
	{
		pathContent: 
		{	
  			file1: 'text content',
		}
	},
	pathExistsWithFiles:
	{
		'path/fileExists': {'abc.txt' : 'some random text'}
	},
	fileWithoutContent:
	{
		pathContent:
		{
			file1: '',
		}
	}
};

function generateTestCases()
{

	var content = "var subject = require('./subject.js')\nvar mock = require('mock-fs');\n";
	for ( var funcName in functionConstraints )
	{
		var params = {};

		// initialize params
		for (var i =0; i < functionConstraints[funcName].params.length; i++ )
		{
			var paramName = functionConstraints[funcName].params[i];
			//params[paramName] = '\'' + faker.phone.phoneNumber()+'\'';
			params[paramName] = '\'\'';
		}

		console.log( params );

		// update parameter values based on known constraints.
		var constraints = functionConstraints[funcName].constraints;
		// Handle global constraints...
		var fileWithContent = _.some(constraints, {kind: 'fileWithContent' });
		var pathExists      = _.some(constraints, {kind: 'fileExists' });

		// plug-in values for parameters
		for( var c = 0; c < constraints.length; c++ )
		{
			var constraint = constraints[c];
			if( params.hasOwnProperty( constraint.ident ) )
			{
				params[constraint.ident] = constraint.value;
				var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
				content += "subject.{0}({1});\n".format(funcName, args );
				//Clearing the param values
				params[constraint.ident] = '\'\'';
			}
		}
		
		//Re-initializing the params
		for( var c = 0; c < constraints.length; c++ )
		{
			var constraint = constraints[c];
			if( params.hasOwnProperty( constraint.ident ) )
			{
				params[constraint.ident] = constraint.value;
				var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
				content += "subject.{0}({1});\n".format(funcName, args );
			}
		}
		
		// Prepare function arguments.
		var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
		console.log(args);
		if( pathExists || fileWithContent )
		{
			content += generateMockFsTestCases(pathExists,fileWithContent,funcName, args, false, false);
			// Bonus...generate constraint variations test cases....
			content += generateMockFsTestCases(!pathExists,fileWithContent,funcName, args, true, false);
			content += generateMockFsTestCases(pathExists,!fileWithContent,funcName, args, false, false);
			content += generateMockFsTestCases(!pathExists,!fileWithContent,funcName, args, false, false);
			content += generateMockFsTestCases(!pathExists,!fileWithContent,funcName, args, true, true);
			content += generateMockFsTestCases(!pathExists,!fileWithContent,funcName, args, true, false);
			
		}
		else if ( _.contains(functionConstraints[funcName].params, "options"))
		{
			for( p in params )
			{
				if(p.indexOf("options") > -1)
				{
					var options = {};
					options["normalize"] = true;
					params[p] = JSON.stringify(options);
				}
			}
			var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
			content += "subject.{0}({1});\n".format(funcName, args );
		}
		else
		{
			// Emit simple test case.
			content += "subject.{0}({1});\n".format(funcName, args );
		}

	}


	fs.writeFileSync('test.js', content, "utf8");

}

function generateMockFsTestCases (pathExists,fileWithContent,funcName,args, pathExistsWithFiles, fileWithoutContent) 
{
	var testCase = "";
	// Build mock file system based on constraints.
	var mergedFS = {};
	if( pathExists )
	{
		for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
	}
	if ( pathExistsWithFiles )
	{
		for (var attrname in mockFileLibrary.pathExistsWithFiles) { mergedFS[attrname] = mockFileLibrary.pathExistsWithFiles[attrname]; }
	}
	if( fileWithContent )
	{
		for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
	}
	if ( fileWithoutContent )
	{
		for (var attrname in mockFileLibrary.fileWithoutContent) { mergedFS[attrname] = mockFileLibrary.fileWithoutContent[attrname]; }
	}

	testCase += 
	"mock(" +
		JSON.stringify(mergedFS)
		+
	");\n";

	testCase += "\tsubject.{0}({1});\n".format(funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
   var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node) 
	{
		if (node.type === 'FunctionDeclaration') 
		{
			var funcName = functionName(node);
			console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			// Check for expressions using argument.
			traverse(node, function(child)
			{
				
				if( child.type === 'LogicalExpression' && child.operator == "&&")
				{
					if( child.left.type === 'BinaryExpression' && child.left.operator == ">")
					{
						if( child.left.left.type == 'Identifier' && params.indexOf( child.left.left.name ) > -1)
						{
							// get expression from original source code:
							var expression = buf.substring(child.left.range[0], child.left.range[1]);
							var rightHand = buf.substring(child.left.right.range[0], child.left.right.range[1])
							rightHand = parseInt(rightHand);
							
							functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: child.left.left.name,
									value: rightHand-1,
									funcName: funcName,
									kind: "integer",
									operator : child.left.operator,
									expression: expression
								}));
								
							functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: child.left.left.name,
									value: rightHand+1,
									funcName: funcName,
									kind: "integer",
									operator : child.left.operator,
									expression: expression
								}));
								
						}
					}
					
					if( child.right.type === 'BinaryExpression' && child.right.operator == "<")
					{
						if( child.right.left.type == 'Identifier' && params.indexOf( child.right.left.name ) > -1)
						{
							// get expression from original source code:
							var expression = buf.substring(child.right.range[0], child.right.range[1]);
							var rightHand = buf.substring(child.right.right.range[0], child.right.right.range[1])
							rightHand = parseInt(rightHand);
							
							functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: child.right.left.name,
									value: rightHand-1,
									funcName: funcName,
									kind: "integer",
									operator : child.right.operator,
									expression: expression
								}));
								
							functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: child.left.name,
									value: rightHand+1,
									funcName: funcName,
									kind: "integer",
									operator : child.operator,
									expression: expression
								}));
								
						}
					}
					
				}
				
				if( child.type === 'BinaryExpression' && child.operator == "==")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
							
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: '\'\'',
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
					else if ( child.left.type == 'Identifier' && child.left.name == "area")
					{
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						
						console.log("AreaValue : " + rightHand);
						rightHand = rightHand.substring(1,4);
						rightHand = rightHand + '-123-1234';
						rightHand = '"' + rightHand + '"';
						console.log("After parse int : " + rightHand);
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: "phoneNumber",
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: "phoneNumber",
								value: '\'\'',
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}
				
				if( child.type === 'BinaryExpression' && child.operator == "!=")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
							
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: '\'\'',
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}
				
				
				if( child.type === 'BinaryExpression' && child.operator == "<")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						rightHand = parseInt(rightHand);
						
						
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand-1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
						
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand+1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
						
					}
				}

				
				if( child.type === 'BinaryExpression' && child.operator == ">")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						rightHand = parseInt(rightHand);
						
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand+1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
							
						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand-1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}
				
				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="indexOf")
				{
					var value = child.arguments[0].value;
					value = '"' + value + '"';
					functionConstraints[funcName].constraints.push( 
						new Constraint(
						{
							ident: child.callee.object.name,
							value: value,
							funcName: funcName,
							kind: "integer"
						}));
				}
				
				if( child.type == "CallExpression" && 
					 child.callee.property &&
					 child.callee.property.name =="readFileSync" )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value:  "'pathContent/file1'",
								funcName: funcName,
								kind: "fileWithContent",
								operator : child.operator,
								expression: expression
							}));
						}
					}
				}

				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="existsSync")
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								// A fake path to a file
								value:  "'path/fileExists'",
								funcName: funcName,
								kind: "fileExists",
								operator : child.operator,
								expression: expression
							}));
						}
					}
				}

			});

			console.log( functionConstraints[funcName]);

		}
	});
}

function traverse(object, visitor) 
{
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
	    for (key in object) {
	        if (object.hasOwnProperty(key)) {
	            child = object[key];
	            if (typeof child === 'object' && child !== null) {
	                traverseWithCancel(child, visitor);
	            }
	        }
	    }
 	 }
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}


if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();