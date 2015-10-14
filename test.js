var subject = require('./subject.js')
var mock = require('mock-fs');
subject.inc('',undefined);
subject.inc('','');
subject.inc(29,'');
subject.inc(31,'');
subject.inc('',undefined);
subject.inc('','');
subject.inc(29,'');
subject.inc(31,'');
subject.inc(31,'');
subject.fileTest('path/fileExists','');
subject.fileTest('','path/fileExists');
subject.fileTest('','pathContent/file1');
subject.fileTest('path/fileExists','');
subject.fileTest('path/fileExists','path/fileExists');
subject.fileTest('path/fileExists','pathContent/file1');
mock({"path/fileExists":{},"pathContent":{"file1":"text content"}});
	subject.fileTest('path/fileExists','pathContent/file1');
mock.restore();
mock({"path/fileExists":{"abc.txt":"some random text"},"pathContent":{"file1":"text content"}});
	subject.fileTest('path/fileExists','pathContent/file1');
mock.restore();
mock({"path/fileExists":{}});
	subject.fileTest('path/fileExists','pathContent/file1');
mock.restore();
mock({});
	subject.fileTest('path/fileExists','pathContent/file1');
mock.restore();
mock({"path/fileExists":{"abc.txt":"some random text"},"pathContent":{"file1":""}});
	subject.fileTest('path/fileExists','pathContent/file1');
mock.restore();
mock({"path/fileExists":{"abc.txt":"some random text"}});
	subject.fileTest('path/fileExists','pathContent/file1');
mock.restore();
subject.normalize('');
subject.format('','',{"normalize":true});
subject.blackListNumber("919-123-1234");
subject.blackListNumber('');
subject.blackListNumber("919-123-1234");
subject.blackListNumber('');
subject.blackListNumber('');
