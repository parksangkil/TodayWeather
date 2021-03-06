/**
 * Created by Peter on 2015. 10. 23..
 *
 * 동네예보 RSS 요청 주 소: http://www.kma.go.kr/wid/queryDFS.jsp?
 * 요청 방식
 *      1. mx, my를 이용하는 방법 : 뒤에 gridx=mx, gridy=my 를 넣어서 request.
 *          ex)http://www.kma.go.kr/wid/queryDFS.jsp?gridx=59&gridy=125
 *      2. AreaNo를 이용하는 방법 : 뒤에 zone=AreaNo 를 넣어서 request
 *          ex)http://www.kma.go.kr/wid/queryDFSRSS.jsp?zone=1159068000
 * 주의 : 두가지 요청방식에 따라 response 형식이 다르니 주의 해야한다
 */
"use strict";
var events = require('events');
var async = require('async');
var req = require('request');
var config = require('../config/config');
var fs = require('fs');
var convert = require('../utils/coordinate2xy');
var xml2json  = require('xml2js').parseString;
var shortRssDb = require('../models/modelShortRss');
var town = require('../models/town');

/*
*   @constructor
*/
function TownRss(){
    var self = this;

    self.addrGrid = 'http://www.kma.go.kr/wid/queryDFS.jsp';
    self.addrZond = 'http://www.kma.go.kr/wid/queryDFSRSS.jsp';

    self.TIME_PERIOD_TOWN_RSS = (1000*60*60*3);
    self.MAX_SHORT_COUNT = 60;
    self.SUCCESS = 0;
    self.ERROR = -1;
    self.RETRY = -2;

    events.EventEmitter.call(this);

    self.on('recvFail', function(index, item){
        setTimeout(function(){
            self.getData(index, item);
        }, 3 * 1000);
    });

    self.on('recvSuccess', function(index){
        self.receivedCount++;

        if(self.receivedCount == self.coordDb.length){
            log.info('receive complete! : count=', self.receivedCount);
        }
    });

    return self;
}

/*
 *
 */
TownRss.prototype.loadList = function(completionCallback){
    var self = this;
    self.coordDb = [];

     town.getCoord(function(err, coordList){
         if(err){
             log.error('RSS> failed to get coord');
         } else {
             log.silly('RSS> coord: ', coordList);
             coordList.forEach(function (coord) {
                 var item = {mCoord: coord};
                 self.coordDb.push(item);
             });

             log.info('RSS> coord count : ', self.coordDb.length);
         }

         if(completionCallback) {
             completionCallback(err);
         }
     });

    return self;
};

/*
 *   @param index
 *   @param url
 *   @param callback
 */
TownRss.prototype.getShortRss = function(index, url, callback){
    var self = this;
    var meta = {};

    meta.method = 'getShortRss';
    meta.url = url;

    log.verbose('get rss URL : ', url);
    req.get(url, {json:true}, function(err, response, body){
        if(err){
            log.warn('failed to req (%d)', index);
            log.warn(err);
            if(callback){
                callback(self.RETRY);
            }
            return;
        }

        if(!response.statusCode || response.statusCode === 404 || response.statusCode === 403){
            log.warn('WARN!!! StatusCode : ', statusCode);
            if(callback){
                callback(self.RETRY);
            }
            return;
        }

        //log.info(body);
        xml2json(body, function(err, result){
            if(err){
                log.error('>>ERROR : failed to convert to json');
                if(callback){
                    callback(self.ERROR);
                }
            }
            try{
                //log.info(result)
                if(callback){
                    callback(self.SUCCESS, result);
                }
            }
            catch(e) {
                log.error('>>ERROR : get exception error in xml2json');
                if(callback){
                    callback(self.ERROR);
                }
            }
        });
    });

    return self;
};
TownRss.prototype.__proto__ = events.EventEmitter.prototype;

TownRss.prototype.leadingZeros = function(n, digits) {
    var zero = '';
    n = n.toString();

    if(n.length < digits) {
        for(var i = 0; i < digits - n.length; i++){
            zero += '0';
        }
    }
    return zero + n;
};

/*
 *   @param cur
 *   @param offset
 *   @return time string
 */
TownRss.prototype.calculateTime = function(cur, offset){
    var self = this;
    //var tmp = new Date('2015-10-30T00:00');
    //log.info(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
    var now = new Date(cur.slice(0, 4) + '-' + cur.slice(4, 6) + '-' + cur.slice(6, 8) + 'T'+ cur.slice(8, 10) + ':'+cur.slice(10, 12));
    var _timezone = now.getTimezoneOffset() * 60000;
    now.setTime(now.getTime() + (offset * 3600000) + _timezone);
    var result =
        self.leadingZeros(now.getFullYear(), 4) +
        self.leadingZeros(now.getMonth()+1 , 2) +
        self.leadingZeros(now.getDate(), 2) +
        self.leadingZeros(now.getHours(), 2) +
        self.leadingZeros(now.getMinutes(), 2);

    return result;
};

/*
 *   @param string
 *   @return Number
 */
TownRss.prototype.convertWeaterString = function(string){
    /* 날씨 요약 : 1.맑음 2.구름조금 3. 구름많음 4.흐림 5.비 6.눈비 7.눈 */
    /* 날씨 요약eng : 1.clear 2.Partly Cloudy 3.Mostly Cloudy 4.Cloudy 5.Rain 6.Snow/Rain 7.Snow */
    /* ① 동(E) ② 북(N) ③ 북동(NE) ④ 북서(NW) ⑤ 남(S) ⑥ 남동(SE) ⑦ 남서(SW) ⑧ 서(W) */
    /* ① E(동) ② N(북) ③ NE(북동) ④ NW(북서) ⑤ S(남) ⑥ SE(남동) ⑦ SW(남서) ⑧ W(서) */
    switch(string){
        case '맑음':
        case 'Clear':
        case '동':
        case 'E':
            return 1;
        case '구름 조금':
        case 'Partly Cloudy':
        case '북':
        case 'N':
            return 2;
        case '구름 많음':
        case 'Mostly Cloudy':
        case '북동':
        case 'NE':
            return 3;
        case '흐림':
        case 'Cloudy':
        case '북서':
        case 'NW':
            return 4;
        case '비':
        case 'Rain':
        case '남':
        case 'S':
            return 5;
        case '눈/비':
        case 'Snow/Rain':
        case '남동':
        case 'SE':
            return 6;
        case '눈':
        case 'Snow':
        case '남서':
        case 'SW':
            return 7;
        case '서':
        case 'W':
            return 8;
        default:
            log.info('convert : ', string);
            return -1;
    }
};

/*
 *   @param index
 *   @param data
 *   @param callback
 *   @return {}
 */
TownRss.prototype.parseShortRss = function(index, data, callback){
    var self = this;
    var dataList = [];
    var coord = {
        mx:0,
        my:0
    };

    //log.info('data:', data);
    //log.info('head:', data.wid.header[0]);
    //log.info('ftm:', data.wid.header[0].tm[0]);
    //log.info('mx:', data.wid.header[0].x[0]);
    //log.info('my:', data.wid.header[0].y[0]);
    //log.info('body:', data.wid.body[0]);
    //log.info('body:', data.wid.body[0].data[0]);

    try{
        coord.mx = parseInt(data.wid.header[0].x[0]);
        coord.my = parseInt(data.wid.header[0].y[0]);
        data.wid.body[0].data.forEach(function(item, index){
            var template = {
                ftm: -1,
                date : '',
                temp: -1,
                tmx: -1,
                tmn: -50,
                sky: -1,
                pty: -1,
                wfKor: -1,
                wfEn: -1,
                pop: -1,
                r12: -1,
                s12: -1,
                ws: -1,
                wd: -1,
                wdKor: -1,
                wdEn: -1,
                reh: -1,
                r06: -1,
                s06: -1
            };
            var hours = parseInt(item.hour[0]);
            var days = parseInt(item.day[0]);

            template.ftm = data.wid.header[0].tm[0];
            template.date = self.calculateTime(template.ftm.slice(0, 8)+ '0000', hours + (days * 24));
            template.temp = parseFloat(item.temp[0]);
            template.tmx = parseFloat(item.tmx[0]);
            template.tmn = parseFloat(item.tmn[0]);
            template.sky = parseFloat(item.sky[0]);
            template.pty = parseFloat(item.pty[0]);
            template.wfKor = self.convertWeaterString(item.wfKor[0]);
            template.wfEn = self.convertWeaterString(item.wfEn[0]);
            template.pop = parseFloat(item.pop[0]);
            template.r12 = parseFloat(item.r12[0]);
            template.s12 = parseFloat(item.s12[0]);
            template.ws = parseFloat(item.ws[0]);
            if(template.ws.toString().length >= 5) {
                template.ws = +template.ws.toFixed(1);
            }
            template.wd = parseFloat(item.wd[0]);
            template.wdKor = self.convertWeaterString(item.wdKor[0]);
            template.wfEn = self.convertWeaterString(item.wfEn[0]);
            template.reh = parseFloat(item.reh[0]);
            template.r06 = parseFloat(item.r06[0]);
            template.s06 = parseFloat(item.s06[0]);

            dataList.push(template);
        });

        dataList.sort(function(a, b){
            if(a.date > b.date){
                return 1;
            }

            if(a.date < b.date){
                return -1;
            }
            return 0;
        });

        //log.info(dataList);
        if(callback){
            callback(self.SUCCESS, {mCoord: coord, pubDate: data.wid.header[0].tm[0], shortData: dataList});
        }
    }
    catch(e){
        log.error('parse error! (%d)', index);
        if(callback){
            callback(self.ERROR);
        }
    }
};

TownRss.prototype.lastestPubDate = function() {
    var self = this;
    var now = new Date();
    var result;
    var resultTime;
    var tz = now.getTime() + (now.getTimezoneOffset() * 60000); // 서버의 타임존을 제거한다.
    tz = tz + ((9*60)*60000);    // 대한민국 타임존을 더한다.
    now.setTime(tz);

    var hour = now.getHours();
    if(hour <= 2) {
        now.setDate(now.getDate() - 1);
        resultTime = '2300';
    } else {
        resultTime = self.leadingZeros(((Math.floor(hour / 3)-1)*3) + 2, 2) + '00';
    }

    result =
        self.leadingZeros(now.getFullYear(), 4) +
        self.leadingZeros(now.getMonth() + 1, 2) +
        self.leadingZeros(now.getDate(), 2) + resultTime;

    return result;
}

/*
 *   @param index
 *   @param data
 */
TownRss.prototype.saveShortRss = function(index, newData, cb){
    var self = this;

    shortRssDb.find({mCoord: newData.mCoord}, function(err, list){
        if(err){
            log.error('fail to db item:', err);
            if(cb) {
                cb(err);
            }
            return;
        }

        if(list.length === 0){
            var item = new shortRssDb({mCoord: newData.mCoord, pubDate: newData.pubDate, shortData: newData.shortData});
            item.save(function(err){
                if(err){
                    log.error('fail to save');
                }
            });

            if(cb) {
                cb();
            }
            //log.silly('> add new item:', newData);
            return;
        }

        list.forEach(function(dbShortList, index){
            //log.info(index + ' :XY> ' + dbShortList.mCoord);
            //log.info(index + ' :D> ' + dbShortList.shortData);
            newData.shortData.forEach(function(newItem){
                var isNew = 1;
                dbShortList.pubDate = newData.pubDate;
                for(var i in dbShortList.shortData){
                    if(dbShortList.shortData[i].date === newItem.date){
                        if(dbShortList.shortData[i].ftm < newItem.ftm){
                            //dbShortList.shortData[i] = newItem;

                            dbShortList.shortData[i].ftm = newItem.ftm;
                            dbShortList.shortData[i].date = newItem.date;
                            dbShortList.shortData[i].temp = newItem.temp;
                            dbShortList.shortData[i].tmx = newItem.tmx;
                            dbShortList.shortData[i].tmn = newItem.tmn;
                            dbShortList.shortData[i].sky = newItem.sky;
                            dbShortList.shortData[i].pty = newItem.pty;
                            dbShortList.shortData[i].wfKor = newItem.wfKor;
                            dbShortList.shortData[i].wfEn = newItem.wfEn;
                            dbShortList.shortData[i].pop = newItem.pop;
                            dbShortList.shortData[i].r12 = newItem.r12;
                            dbShortList.shortData[i].s12 = newItem.s12;
                            dbShortList.shortData[i].ws = newItem.ws;
                            dbShortList.shortData[i].wd = newItem.wd;
                            dbShortList.shortData[i].wdKor = newItem.wdKor;
                            dbShortList.shortData[i].wdEn = newItem.wdEn;
                            dbShortList.shortData[i].reh = newItem.reh;
                            dbShortList.shortData[i].r06 = newItem.r06;
                            dbShortList.shortData[i].s06 = newItem.s06;
                        }
                        isNew = 0;
                        break;
                    }
                }

                if(isNew){
                    dbShortList.shortData.push(newItem);
                }
            });

            dbShortList.shortData.sort(function(a, b) {
                var nRet = 0;

                if(a.date > b.date){
                    nRet = 1;
                } else if(a.date < b.date) {
                    nRet = -1;
                }

                return nRet;
            });

            if(dbShortList.shortData.length > self.MAX_SHORT_COUNT){
                dbShortList.shortData = dbShortList.shortData.slice((dbShortList.shortData.length - self.MAX_SHORT_COUNT));
            }

            dbShortList.save(function(err){
                if(err){
                    log.error('fail to save');
                }
            });
        });

        if(cb) {
            cb();
        }
    });
};

/*
 *   @param mx
 *   @param my
 *   @return {*} townData
 */
TownRss.prototype.getTownRssDb = function(mx, my){
    var self = this;

    //log.info('search : ', mx, my);
    for(var i in self.townRssDb){
        if(self.townRssDb[i].mCoord.mx === mx && self.townRssDb[i].mCoord.my === my){
            return self.townRssDb[i];
        }
    }
    return {};
};

/*
 *   @param mx
 *   @param my
 *   @return url string
 */
TownRss.prototype.makeUrl = function(mx, my){
    var self = this;

    return self.addrGrid + '?gridx=' + mx + '&gridy=' +my;
};

/*
 * @param item
 * @param index
 * @param [optional] callback function for completion.
 */
TownRss.prototype.getData = function(index, item, cb){
    var self = this;
    var url = self.makeUrl(item.mCoord.mx, item.mCoord.my);
    self.getShortRss(index, url, function(err, RssData){
        if(err){
            log.error('failed to get rss (%d)', index);
            if(err == self.RETRY){
                self.emit('recvFail', index, item);
            }

            if(cb) {
                cb(err);
            }

            return;
        }

        self.parseShortRss(index, RssData, function(err, result){
            if(err){
                log.error('failed to parse short rss(%d)', index);
                if(cb) {
                    cb(err);
                }
                return;
            }

            self.saveShortRss(index, result, function(err){
                if(err){
                    log.error('failed to save the data to DB');
                    if(cb) {
                        cb(err);
                    }
                    return;
                }

                if(cb) {
                    cb();
                }
            });
        });
    });
};

/*
 *
 */
TownRss.prototype.mainTask = function(completionCallback){
    var self = this;
    var gridList;

    log.info('RSS> start rss!1');

    gridList = self.coordDb;

    self.receivedCount = 0;
    if(gridList.length == 0){
        log.info('RSS> there are no town list');
        return;
    }

    var lastestPubDate = self.lastestPubDate();

    var index = 0;

    async.map(gridList,
        function(item, callback) {
            async.waterfall([
                function(cb) {
                    shortRssDb.find({'mCoord.my' :item.mCoord.my, 'mCoord.mx':item.mCoord.mx}, function(err, list) {
                        index++;
                        if(err
                            || (list.length === 0)
                            || (list[0].pubDate === undefined)) {
                            log.info('rss : get new data : ' + index + ', (' + item.mCoord.mx + ',' + item.mCoord.my + ')');
                            cb(err, item);
                        } else {
                            if (Number(list[0].pubDate) < Number(lastestPubDate)) {
                                log.debug('rss : refresh data : ' + index + ', (' + item.mCoord.mx + ',' + item.mCoord.my + ')');
                                cb(err, item);
                            } else {
                                log.debug('rss : already latest data');
                                cb(err, undefined);
                            }
                        }
                    })
                },
                function(item, cb) {
                    if(item != undefined && item.mCoord !== undefined && item.mCoord.mx !== undefined)
                    {
                        self.getData(index, item, cb);
                    } else {
                        //already updated
                        //log.info('rss : invalid item value.');
                        cb();
                    }
                }],
                function(err) {
                    if(callback) {
                        callback();
                    }
                })
         }, function(err, result) {
            log.info('rss: finished !!' + index);
            if(completionCallback) {
                completionCallback();
            }
        });
};

TownRss.prototype.StartShortRss = function(){
    var self = this;

    self.loadList();
    self.mainTask();

    self.loopTownRssID = setInterval(function() {

        self.mainTask();

    }, self.TIME_PERIOD_TOWN_RSS);
};

module.exports = TownRss;