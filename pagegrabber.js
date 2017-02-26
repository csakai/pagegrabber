var request = require('request');
var fs = require('fs');

function PageGrabber(chapter, url, timeout) {
  console.log('timeout', timeout);
  this.timeout = timeout;
  this.directory = 'chapter' + chapter;
  fs.mkdirSync(this.directory);
  this.currentUrl = url;
  this.dotIndex = url.lastIndexOf('.');
  this.fileTypes = [ 'png', 'jpg' ];
  this.attempts = [];
  this.attemptsLength = 0;
  this.getPage();
}

PageGrabber.prototype.getNextArgs = function() {
  var latestAttempt = this.attempts[this.attemptsLength-1];
  var nextPage, nextFileType;
  for (var index in this.fileTypes) {
    var key = this.fileTypes[index];
    if (latestAttempt.fileTypes[key] === true) {
      nextFileType = key;
      nextPage = latestAttempt.pageNumber+1;
      break;
    } else if (!latestAttempt.fileTypes[key]) {
      nextFileType = key;
      nextPage = latestAttempt.pageNumber;
    }
  }
  return (!nextPage && !nextFileType) ? undefined : [ nextPage, nextFileType ];
};

PageGrabber.prototype.cleanup = function() {
  var pg = this;
  for (var index in pg.attempts) {
    var attempt = pg.attempts[index];
    Object.keys(attempt.fileTypes).forEach(function (fileType) {
      var pageNumber = attempt.pageNumber;
      var isSuccessful = attempt.fileTypes[fileType];
      if (isSuccessful && isSuccessful !== true) {
        //if not truthy, but not true, it's a filename
        var filename = isSuccessful;
        fs.unlink(filename, function(err) {
          if (err) {
            console.log('an error occurred at the delete step!');
            console.log(pageNumber, fileType, filename);
          } else {
            console.log('deletion of ', filename, 'successful!');
          }
        });
      }
    });
  }
};

PageGrabber.prototype.isNewPageAttempt = function (pageNumber) {
  return this.attempts[this.attemptsLength-1].pageNumber !== pageNumber;
};

PageGrabber.prototype.saveAttempt = function(pageNumber, fileType, isSuccessful) {
  var attempt = {
    pageNumber: pageNumber,
    fileTypes: {}
  };
  if (!this.attemptsLength || this.isNewPageAttempt(pageNumber)) {
    this.attempts.push(attempt);
    this.attemptsLength++;
  } else if (this.attempts[this.attemptsLength-1].pageNumber === pageNumber) {
    attempt = this.attempts[this.attemptsLength-1];
  }
  attempt.fileTypes[fileType] = isSuccessful;
};

PageGrabber.prototype.parsePageNumber = function() {
  var numberIndex = this.currentUrl.lastIndexOf('0') + 1;
  this.pageNumberIndex = numberIndex;
  return parseInt(this.currentUrl.substring(numberIndex, this.dotIndex));
};

PageGrabber.prototype.parseFileType = function() {
  var typeIndex = this.currentUrl.lastIndexOf('.') + 1;
  return this.currentUrl.substr(typeIndex);
};

PageGrabber.prototype.updateUrl = function(pageNumber, fileType) {
  if (pageNumber === 10) {
    this.pageNumberIndex = this.dotIndex - 2;
  }
  var urlPre = this.currentUrl.substr(0, this.pageNumberIndex);
  var urlPost = '.' + fileType;
  this.currentUrl = urlPre + pageNumber + urlPost;
};

PageGrabber.prototype.getFilename = function(pageNumber, fileType) {
  if (pageNumber < 10) {
    pageNumber = '0' + pageNumber;
  }
  return this.directory + '/' + this.directory + '-' + pageNumber + '.' + fileType;
};

PageGrabber.prototype.getPage = function(pageNumber, fileType) {
  var pg = this;
  if (!pageNumber && !fileType) {
    pageNumber = this.parsePageNumber();
    fileType = this.parseFileType();
  } else {
    this.updateUrl(pageNumber, fileType);
  }
  var filename = this.getFilename(pageNumber, fileType);
  var statusCode;
  console.log('url:', this.currentUrl, 'filename:', filename);
  var writeableStream = fs.createWriteStream(filename)
  .on('close', function() {
    console.log('the write stream was closed\n');
    pg.saveAttempt(pageNumber, fileType, (statusCode === 200 || this.path));
    var nextArgs = pg.getNextArgs();
    if (nextArgs === undefined) {
      pg.cleanup();
    } else {
      setTimeout(function() {
        pg.getPage.apply(pg, nextArgs);
      }, this.timeout);
    }
  });
  request.get(this.currentUrl, { encoding: null })
  .on('error', function(err) {
    console.log('there was an error!', err);
  })
  .on('response', function(response) {
    console.log('response received', response.statusCode);
    statusCode = response.statusCode;
  })
  .pipe(writeableStream);
};

var chapter = process.argv[2];
var baseUrl = process.argv[3];
var timeout = process.argv[4] || 1000;

var pageGrabber = new PageGrabber(chapter, baseUrl, timeout);
