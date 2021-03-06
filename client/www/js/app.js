// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('starter', [
    'ionic',
    'ionic.service.core',
    'ionic.service.analytics',
    'starter.controllers',
    'starter.services',
    'controller.purchase',
    'service.twads',
    'service.push',
    'ionic-timepicker',
    'ngCordova'
])
    .run(function($ionicPlatform, Util, $rootScope, $location, WeatherInfo) {
        $ionicPlatform.ready(function() {

            if (navigator.splashscreen) {
                navigator.splashscreen.hide();
            }

            if (Util.isDebug()) {
                Util.ga.debugMode();
            }

            if (ionic.Platform.isIOS()) {
                Util.ga.startTrackerWithId('[GOOGLE_ANALYTICS_IOS_KEY]');
                if (window.applewatch) {
                    applewatch.init(function () {
                        console.log('Succeeded to initialize for apple-watch');
                    }, function (err) {
                        console.log('Failed to initialize apple-watch', err);
                    }, 'group.net.wizardfactory.todayweather');
                }
            } else if (ionic.Platform.isAndroid()) {
                Util.ga.startTrackerWithId('[GOOGLE_ANALYTICS_ANDROID_KEY]');
            }

            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
                cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
                cordova.plugins.Keyboard.disableScroll(true);
            }
        });

        $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState) {
            if (toState.name === 'tab.search') {
                $rootScope.viewColor = '#ec72a8';
                if (window.StatusBar) {
                    StatusBar.backgroundColorByHexString('#EC407A');
                }
            } else if (toState.name === 'tab.forecast') {
                if (fromState.name === '') {
                    var guideVersion = localStorage.getItem('guideVersion');
                    if (guideVersion === null || Util.guideVersion > Number(guideVersion)) {
                        $location.path('/guide');
                        return;
                    } else if (WeatherInfo.getEnabledCityCount() === 0) {
                        $location.path('/tab/search');
                        return;
                    }
                }

                $rootScope.viewColor = '#03A9F4';
                if (window.StatusBar) {
                    StatusBar.backgroundColorByHexString('#0288D1');
                }
            } else if (toState.name === 'tab.dailyforecast') {
                $rootScope.viewColor = '#00BCD4';
                if (window.StatusBar) {
                    StatusBar.backgroundColorByHexString('#0097A7');
                }
            } else if (toState.name === 'tab.setting') {
                $rootScope.viewColor = '#FFA726';
                if (window.StatusBar) {
                    StatusBar.backgroundColorByHexString('#FB8C00');
                }
            } else if (toState.name === 'guide') {
                if (window.StatusBar) {
                    StatusBar.backgroundColorByHexString('#0288D1');
                }
            }
        });
    })

    .config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider, $compileProvider, ionicTimePickerProvider) {

        //$compileProvider.debugInfoEnabled(Util.isDebug());
        $compileProvider.debugInfoEnabled(false);

        //add chrome-extension for chrome extension
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|file|ftp|mailto|chrome-extension|blob:chrome-extension):/);
        $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|file|ftp|mailto|chrome-extension|blob:chrome-extension):/);

        $compileProvider.directive('ngShortChart', function() {
            return {
                restrict: 'A',
                transclude: true,
                link: function (scope, iElement) {
                    var marginTop = 12;
                    var textTop = 5;
                    var margin = {top: marginTop, right: 0, bottom: 12, left: 0, textTop: textTop};
                    var width, height, x, y;
                    var svg, initLine, line;
                    var displayItemCount = 0;

                    //parent element의 heigt가 변경되면, svg에 있는 모든 element를 지우고, height를 변경 다시 그림.
                    //chart가 나오지 않는 경우에는 height가 0이므로 그때는 동작하지 않음.
                    //element height는 광고 제거,추가 그리고 시간별,요일별 로 변경될때 변경됨.
                    scope.$watch(function () {
                        return iElement[0].getBoundingClientRect().height;
                    }, function(newValue) {
                        if (newValue === 0 || newValue === height) {
                            return;
                        }
                        width = iElement[0].getBoundingClientRect().width;
                        height = iElement[0].getBoundingClientRect().height;

                        //0.9.1까지 displayItemCount가 없음.
                        displayItemCount = scope.timeChart[1].displayItemCount;
                        if (displayItemCount == undefined || displayItemCount == 0) {
                            displayItemCount = 3;
                        }

                        console.log('scope watch');
                        var shortTableHeight = scope.getShortTableHeight(displayItemCount);
                        margin.top = marginTop + shortTableHeight;
                        margin.textTop = textTop - shortTableHeight;

                        x = d3.scale.ordinal().rangeBands([margin.left, width - margin.right]);
                        y = d3.scale.linear().range([height - margin.bottom, margin.top]);

                        if (svg != undefined) {
                            svg.selectAll("*").remove();
                            svg.attr('height', height);
                        }
                        else {
                            svg = d3.select(iElement[0]).append('svg')
                                .attr('width', width)
                                .attr('height', height);
                        }

                        initLine = d3.svg.line()
                            .interpolate('linear')
                            .x(function (d, i) {
                                return x.rangeBand() * i + x.rangeBand() / 2;
                            })
                            .y(height);

                        line = d3.svg.line()
                            .interpolate('linear')
                            .x(function (d, i) {
                                return x.rangeBand() * i + x.rangeBand() / 2;
                            })
                            .y(function (d) {
                                return y(d.value.t3h);
                            });

                        chart();
                    });

                    var chart = function () {
                        var data = scope.timeChart;

                        if (x == undefined || y == undefined || svg == undefined || data == undefined) {
                            return;
                        }

                        var currentTime = scope.currentWeather.time;

                        x.domain(d3.range(data[0].values.length));
                        y.domain([
                            d3.min(data, function (c) {
                                return d3.min(c.values, function (v) {
                                    return v.value.t3h;
                                });
                            }),
                            d3.max(data, function (c) {
                                return d3.max(c.values, function (v) {
                                    return v.value.t3h;
                                });
                            })
                        ]).nice();

                        d3.svg.axis()
                            .scale(x)
                            .orient('bottom');

                        d3.svg.axis()
                            .scale(y)
                            .orient('left');

                        // draw guideLine
                        var guideLines = svg.selectAll('.guide-line')
                            .data(function () {
                                return data[1].values;
                            });

                        guideLines.enter().append('line')
                            .attr('class', 'guide-line')
                            .attr('x1', function (d, i) {
                                return x.rangeBand() * i + x.rangeBand() / 2+0.5;
                            })
                            .attr('x2', function (d, i) {
                                return x.rangeBand() * i + x.rangeBand() / 2+0.5;
                            })
                            .attr('y1', 0)
                            .attr('y2', height)
                            .attr('stroke-width', 1)
                            .attr('stroke', '#fefefe')
                            .attr('stroke-opacity', '0.1');

                        guideLines.exit().remove();

                        var currentRect = svg.selectAll('.current-rect').data(function () {
                           return [data[1].currentIndex];
                        });

                        currentRect.enter().append('rect')
                            .attr('class', 'current-rect');

                        currentRect
                            .attr('stroke', '#039BE5')
                            .attr('fill', '#039BE5')
                            .attr('x', function (index) {
                                return x.rangeBand() * index + x.rangeBand() / 2 + 0.5;
                            })
                            .attr('y', function () {
                                return 0;
                            })
                            .attr('width', x.rangeBand() - 0.5)
                            .attr('height', height);

                        currentRect.exit().remove();

                        var hourlyTables = svg.selectAll('.hourly-table')
                            .data(function () {
                                return data[1].values;
                            });

                        var hourObject = hourlyTables.enter()
                            .append('g')
                            .attr('class', 'hourly-table');

                        hourObject.append("svg:image")
                            .attr('class', 'weatherIcon')
                            .attr("xlink:href", function (d) {
                               return "img/weatherIcon2-color/"+ d.value.skyIcon+".png";
                            })
                            .attr("x", function (d, i) {
                                return x.rangeBand() * i - scope.smallImageSize/2;
                            })
                            .attr("y", 0)
                            .attr("width", scope.smallImageSize)
                            .attr("height", scope.smallImageSize);

                        hourObject.append("text")
                            .attr('class', 'body1')
                            .attr('fill', 'white')
                            .attr("text-anchor", "middle")
                            .attr("x", function (d, i) {
                                return x.rangeBand() * i;
                            })
                            .attr("y", function(){
                                if (displayItemCount >=1) {
                                    return scope.smallImageSize+12;//margin top
                                }
                            })
                            .text(function (d) {
                                return d.value.pop;
                            })
                            .append('tspan')
                            .attr('font-size', '10px')
                            .text('%');

                        hourObject.append("text")
                            .attr('class', 'caption')
                            .attr('fill', 'white')
                            .attr("text-anchor", "middle")
                            .style('letter-spacing', 0)
                            .attr("x", function (d, i) {
                                return x.rangeBand() * i;
                            })
                            .attr("y", function () {
                                var y = 12; //margin top
                                if (displayItemCount >=1) {
                                    y += scope.smallImageSize;
                                }
                                if (displayItemCount >=2) {
                                    y += 15;//pop body1
                                }
                                return y - 3;
                            })
                            .text(function (d) {
                                if (d.value.rn1) {
                                    return d.value.rn1>=10?Math.round(d.value.rn1):d.value.rn1;
                                }
                                else if (d.value.r06) {
                                    return d.value.r06>=10?Math.round(d.value.r06):d.value.r06;
                                }
                                else if (d.value.s06) {
                                    return d.value.s06>=10?Math.round(d.value.s06):d.value.s06;
                                }
                                return '';
                            })
                            .append('tspan')
                            .attr('font-size', '10px')
                            .text(function (d) {
                                if (d.value.rn1 || d.value.r06) {
                                    return 'mm';
                                }
                                else if (d.value.s06) {
                                    return 'cm';
                                }
                            });

                        hourObject.filter(function(d, i) {
                           if (i == 0) {
                               return true;
                           }
                            return false;
                        }).remove();

                        var lineGroups = svg.selectAll('.line-group')
                            .data(data);

                        lineGroups.enter()
                            .append('g')
                            .attr('class', 'line-group');

                        // draw line
                        var lines = lineGroups.selectAll('.line')
                            .data(function(d) {
                                return [d];
                            })
                            .attr('d', function (d) {
                                return initLine(d.values);
                            });

                        lines.enter()
                            .append('path')
                            .attr('class', function (d) {
                                return 'line line-' + d.name;
                            })
                            .attr('d', function (d) {
                                return initLine(d.values);
                            });

                        lines.attr('d', function (d) {
                            return line(d.values);
                        });

                        // draw point
                        var linePoints = lineGroups.selectAll('.line-point')
                            .data(function (d) {
                                return [d];
                            });

                        linePoints.enter()
                            .append('g')
                            .attr('class', 'line-point');

                        var circles = linePoints.selectAll('circle')
                            .data(function (d) {
                                return d.values;
                            })
                            .attr('cy', height);

                        circles.enter()
                            .append('circle')
                            .attr('class', function (d) {
                                return 'circle-' + d.name;
                            })
                            .attr('r', 10)
                            .attr('cx', function (d, i) {
                                return x.rangeBand() * i + x.rangeBand() / 2;
                            })
                            .attr('cy', height);

                        circles.attr('cy', function (d) {
                            return y(d.value.t3h);
                        });

                        circles.exit()
                            .remove();

                        // draw current point
                        var point = lineGroups.selectAll('.point')
                            .data(function(d) {
                                return [d];
                            })
                            .attr('r', function () {
                                return currentTime % 3 == 0 ? 11:5;
                            })
                            .attr('cx', function (d) {
                                var cx1, cx2;
                                for (var i = 0; i < d.values.length; i = i + 1) {
                                    if (d.values[i].value.day === '오늘') {
                                        cx1 = i + Math.floor(currentTime / 3) - 1;
                                        cx2 = currentTime % 3;
                                        break;
                                    }
                                }
                                return x.rangeBand() * (cx1 + cx2 / 3) + x.rangeBand() / 2;
                            })
                            .attr('cy', height);

                        point.enter()
                            .append('circle')
                            .attr('class', function (d) {
                                return 'point circle-' + d.name + '-current';
                            })
                            .attr('r', function () {
                                return currentTime % 3 == 0 ? 11:5;
                            })
                            .attr('cx', function (d) {
                                var cx1, cx2;
                                for (var i = 0; i < d.values.length; i = i + 1) {
                                    if (d.values[i].value.day === '오늘') {
                                        cx1 = i + Math.floor(currentTime / 3) - 1;
                                        cx2 = currentTime % 3;
                                        break;
                                    }
                                }
                                return x.rangeBand() * (cx1 + cx2 / 3) + x.rangeBand() / 2;
                            })
                            .attr('cy', height);

                        point.attr('cx', function (d) {
                            var cx1, cx2;
                            for (var i = 0; i < d.values.length; i = i + 1) {
                                if (d.values[i].value.day === '오늘') {
                                    cx1 = i + Math.floor(currentTime / 3) - 1;
                                    cx2 = currentTime % 3;
                                    break;
                                }
                            }
                            return x.rangeBand() * (cx1 + cx2 / 3) + x.rangeBand() / 2;
                        })
                            .attr('cy', function (d) {
                                var cx1, cx2;
                                for (var i = 0; i < d.values.length; i = i + 1) {
                                    if (d.values[i].value.day === '오늘') {
                                        cx1 = i + Math.floor(currentTime / 3) - 1;
                                        cx2 = currentTime % 3;
                                        break;
                                    }
                                }
                                var cy1 = d.values[cx1].value.t3h;
                                var cy2 = d.values[cx1+1].value.t3h;

                                if (cx2 === 1) {
                                    return y(cy1 + (cy2 - cy1) / 3);
                                }
                                else if (cx2 === 2) {
                                    return y(cy1 + (cy2 - cy1) / 3 * 2);
                                }
                                return y(cy1);
                            });

                        point.exit()
                            .remove();

                        // draw value
                        var lineValues = lineGroups.selectAll('.line-value')
                            .data(function (d) {
                                return [d];
                            });

                        lineValues.enter()
                            .append('g')
                            .attr('class', 'line-value');

                        var texts = lineValues.selectAll('text')
                            .data(function (d) {
                                return d.values;
                            })
                            .style("fill", function (d) {
                                if (d.name == "today") {
                                    if (d.value.time  === currentTime && d.value.date === scope.currentWeather.date) {
                                       return '#fefefe';
                                    }
                                }
                                return '#0288D1';
                            })
                            .attr('y', height - margin.bottom + margin.textTop)
                            .text(function (d) {
                                return Math.round(d.value.t3h);
                            });

                        texts.enter()
                            .append('text')
                            .attr('class', function (d) {
                                return 'text-' + d.name;
                            })
                            .style("fill", function (d) {
                                if (d.name == "today") {
                                    if (d.value.time === currentTime && d.value.date === scope.currentWeather.date) {
                                       return '#fefefe';
                                    }
                                }
                                return '#0288D1';
                            })
                            .attr('text-anchor', 'middle')
                            .attr('dy', margin.top)
                            .attr('x', function (d, i) {
                                return x.rangeBand() * i + x.rangeBand() / 2;
                            })
                            .attr('y', height - margin.bottom + margin.textTop)
                            .text(function (d) {
                                return Math.round(d.value.t3h);
                            });

                        texts.attr('y', function (d) {
                            return y(d.value.t3h) - margin.bottom + margin.textTop;
                        });

                        texts.exit()
                            .remove();
                    };

                    scope.$watch('timeWidth', function(newValue) {
                        console.log('timeWidth='+newValue);
                        //guide에서 나올때, 점들이 모이는 증상이 있음.
                        if (newValue == undefined || newValue == width) {
                            console.log('new value is undefined or already set same width='+width);
                            return;
                        }

                        width = newValue;
                        x = d3.scale.ordinal().rangeBands([margin.left, width - margin.right]);

                        if (svg) {
                            svg.attr('width', width);
                            svg.selectAll("*").remove();

                            initLine = d3.svg.line()
                                .interpolate('linear')
                                .x(function (d, i) {
                                    return x.rangeBand() * i + x.rangeBand() / 2;
                                })
                                .y(height);

                            line = d3.svg.line()
                                .interpolate('linear')
                                .x(function (d, i) {
                                    return x.rangeBand() * i + x.rangeBand() / 2;
                                })
                                .y(function (d) {
                                    return y(d.value.t3h);
                                });

                            chart();
                        }
                    });

                    scope.$watch('timeChart', function (newVal) {
                        if (newVal) {
                            console.log("update timeChart");
                            var shortTableHeight = scope.getShortTableHeight(displayItemCount);
                            margin.top = marginTop + shortTableHeight;
                            margin.textTop = textTop - shortTableHeight;
                            y = d3.scale.linear().range([height - margin.bottom, margin.top]);
                            chart();
                        }
                    });

                    scope.$watch('forecastType', function (newVal) {
                        if (newVal === true) {
                            console.log("change forecastType");
                            chart();
                        }
                    });
                }
            };
        });

        $compileProvider.directive('ngMidChart', function() {
            return {
                restrict: 'A',
                transclude: true,
                link: function (scope, iElement) {
                    var marginTop = 18;
                    var displayItemCount = scope.dayChart[0].displayItemCount;
                    var margin = {top: marginTop, right: 0, bottom: 18, left: 0, textTop: 5};
                    var width, height, x, y;
                    var svg;

                    //shortChart 주석 참고.
                    scope.$watch(function () {
                        return iElement[0].getBoundingClientRect().height;
                    }, function(newValue) {
                        if (newValue === 0 || height === newValue) {
                            return;
                        }
                        width = iElement[0].getBoundingClientRect().width;
                        height = iElement[0].getBoundingClientRect().height;

                        console.log("mid scope watch");
                        margin.top = marginTop + scope.getMidTableHeight(displayItemCount);

                        x = d3.scale.ordinal().rangeBands([margin.left, width - margin.right]);
                        y = d3.scale.linear().range([height - margin.bottom, margin.top]);

                        if (svg != undefined) {
                            svg.selectAll("*").remove();
                            svg.attr('height', height);
                        }
                        else {
                            svg = d3.select(iElement[0]).append('svg')
                                .attr('width', width)
                                .attr('height', height);
                        }
                        chart();
                    });

                    var chart = function () {
                        var data = scope.dayChart;
                        if (x == undefined || y == undefined || svg == undefined || data == undefined) {
                            return;
                        }

                        x.domain(d3.range(data[0].values.length));
                        y.domain([
                            d3.min(data[0].values, function (c) {
                                return c.tmn;
                            }),
                            d3.max(data[0].values, function (c) {
                                return c.tmx;
                            })
                        ]).nice();

                        d3.svg.axis()
                            .scale(x)
                            .orient('bottom');

                        d3.svg.axis()
                            .scale(y)
                            .orient('left');

                        var currentRect = svg.selectAll('.currentRect').data(data);

                        currentRect.enter().append('rect')
                            .attr('class', 'currentRect')
                            .attr('fill', '#00ACC1')
                            .attr('x', function (d) {
                                for (var i = 0; i < d.values.length; i++) {
                                    if (d.values[i].fromToday === 0) {
                                        return x.rangeBand() * i;
                                    }
                                }
                                return 0;
                            })
                            .attr('y', function () {
                                return 0;
                            })
                            .attr('width', x.rangeBand()-0.5)
                            .attr('height', height);

                        currentRect.exit().remove();

                        // draw bar
                        var group = svg.selectAll('.bar-group')
                            .data(data);

                        group.enter().append('g')
                            .attr('class', 'bar-group');

                        // draw guideLine
                        var guideLines = group.selectAll('.guide-line')
                            .data(function (d) {
                                return d.values;
                            });

                        guideLines.enter().append('line')
                            .attr('class', 'guide-line');

                        guideLines.exit().remove();

                        guideLines
                            .attr('x1', function (d, i) {
                                return x.rangeBand() * i+0.5;
                            })
                            .attr('x2', function (d, i) {
                                return (x.rangeBand()) * i+0.5;
                            })
                            .attr('y1', 0)
                            .attr('y2', height)
                            .attr('stroke-width', 1)
                            .attr('stroke', '#fefefe')
                            .attr('stroke-opacity', '0.1');

                        var dayTables = svg.selectAll('.day-table')
                            .data(function () {
                                return data[0].values;
                            });

                        var dayObject = dayTables.enter()
                            .append('g')
                            .attr('class', 'day-table');

                        dayObject.append("text")
                                .attr('class', 'subheading')
                                .attr('fill', 'white')
                                .attr("text-anchor", "middle")
                                .attr("x", function (d, i) {
                                    return x.rangeBand() * i + x.rangeBand() / 2;
                                })
                                .attr("y", function(){
                                    //0이 아닌 18이어야 하는 것이 이상함.
                                    return marginTop;
                                })
                                .text(function (d) {
                                    return d.date.substr(6,2);
                                });

                        dayObject.append("svg:image")
                                .attr('class', 'skyAm')
                                .attr("xlink:href", function (d) {
                                    return "img/weatherIcon2-color/"+ d.skyAm+".png";
                                })
                                .attr("x", function (d, i) {
                                    return x.rangeBand() * i + (x.rangeBand() - scope.smallImageSize*0.8)/2;
                                })
                                .attr("y", function (d) {
                                    var y = 17 + 2;
                                    if (d.skyAm == d.skyPm || d.skyPm == undefined) {
                                        y += scope.smallImageSize*0.8/3;
                                    }
                                    return y;
                                })
                                .attr("width", scope.smallImageSize*0.8)
                                .attr("height", scope.smallImageSize*0.8)
                                .filter(function (d) {
                                    if (d.skyAm == undefined) {
                                        return true;
                                    }
                                    return false;
                                }).remove();

                        dayObject.append("svg:image")
                            .attr('class', 'skyPm')
                            .attr("xlink:href", function (d) {
                               return "img/weatherIcon2-color/"+ d.skyPm+".png";
                            })
                            .attr("x", function (d, i) {
                                return x.rangeBand() * i + (x.rangeBand() - scope.smallImageSize*0.8)/2;
                            })
                            .attr("y", function (d) {
                                var y = 17;
                                if (d.skyAm == undefined) {
                                    y += 2 + scope.smallImageSize*0.8/3;
                                }
                                else {
                                    y += scope.smallImageSize*0.8
                                }
                                return y;
                            })
                            .attr("width", scope.smallImageSize*0.8)
                            .attr("height", scope.smallImageSize*0.8)
                            .filter(function(d) {
                                if (d.skyAm == d.skyPm || d.skyPm == undefined) {
                                    return true;
                                }
                                return false;
                            }).remove();

                        dayObject.append("text")
                            .attr('class', 'body1')
                            .attr('fill', 'white')
                            .attr("text-anchor", "middle")
                            .attr("x", function (d, i) {
                                return x.rangeBand() * i + x.rangeBand() / 2;
                            })
                            .attr("y", function(d){
                                var y = 17+ scope.smallImageSize*0.8 ;
                                if (d.skyAm == d.skyPm || d.skyAm == undefined || d.skyPm == undefined) {
                                    y += scope.smallImageSize*0.8/3;
                                }
                                else {
                                    y += scope.smallImageSize*0.8 ;
                                }
                                y += 14;
                                return y;
                            })
                            .text(function (d) {
                                if (d.fromToday >=0 && d.pop) {
                                    return d.pop;
                                }
                                return "";
                            })
                            .append('tspan')
                            .attr('font-size', '10px')
                            .text(function (d) {
                                if (d.fromToday >=0 && d.pop) {
                                   return "%";
                                }
                                return "";
                            });

                        dayObject.append("text")
                            .attr('class', 'caption')
                            .attr('fill', 'white')
                            .attr("text-anchor", "middle")
                            .style('letter-spacing', 0)
                            .attr("x", function (d, i) {
                                return x.rangeBand() * i + x.rangeBand() / 2;
                            })
                            .attr("y", function(d){
                                var y = 17 + scope.smallImageSize*0.8;
                                if (d.skyAm == d.skyPm || d.skyAm == undefined || d.skyPm == undefined) {
                                    y += scope.smallImageSize*0.8/3;
                                }
                                else {
                                    y += scope.smallImageSize*0.8;
                                }
                                y += 2; //margin
                                if (d.pop && d.fromToday >= 0) {
                                    y += 15;
                                }
                                y+=10;
                                return y;
                            })
                            .text(function (d) {
                                var value;
                                if (d.rn1) {
                                    value = d.rn1;
                                }
                                else if (d.r06) {
                                    value = d.r06;
                                }
                                else if (d.s06) {
                                    value = d.s06;
                                }
                                else {
                                    return '';
                                }
                                if (value >= 10) {
                                    value = Math.round(value);
                                }
                                return value;
                            })
                            .append('tspan')
                            .attr('font-size', '10px')
                            .text(function (d) {
                                if (d.rn1 || d.r06) {
                                    return 'mm';
                                }
                                else if (d.s06) {
                                   return 'cm';
                                }
                                return "";
                            });

                        var rects = group.selectAll('.rect')
                            .data(function (d) {
                                return d.values;
                            });

                        rects.enter().append('rect')
                            .attr('class', 'rect');

                        rects.exit().remove();

                        rects.attr('x', function (d, i) {
                            return x.rangeBand() * i + x.rangeBand() / 2 - 1;
                        })
                            .attr('width', 2)
                            .attr('y', function (d) {
                                return y(d.tmn);
                            })
                            .attr('height', 0)
                            .attr('y', function (d) {
                                return y(d.tmx);
                            })
                            .attr('height', function (d) {
                                return y(d.tmn) - y(d.tmx);
                            });

                        // draw max value
                        var maxValue = svg.selectAll('.bar-max-value')
                            .data(data);

                        maxValue.enter()
                            .append('g')
                            .attr('class', 'bar-max-value');

                        var maxTexts = maxValue.selectAll('text')
                            .data(function (d) {
                                return d.values;
                            });

                        maxTexts.enter().append('text')
                            .attr('class', 'text');

                        maxTexts.exit().remove();

                        maxTexts.attr('x', function (d, i) {
                            return x.rangeBand() * i + x.rangeBand() / 2;
                        })
                            .attr('y', function (d) {
                                return y(d.tmn) - margin.top - margin.textTop;
                            })
                            .attr('dy', margin.top)
                            .attr('text-anchor', 'middle')
                            .text(function (d) {
                                return Math.round(d.tmx) + '˚';
                            })
                            .attr('class', 'text-today')
                            .attr('y', function (d) {
                                return y(d.tmx) - margin.top - margin.textTop;
                            });

                        // draw min value
                        var minValue = svg.selectAll('.bar-min-value')
                            .data(data);

                        minValue.enter()
                            .append('g')
                            .attr('class', 'bar-min-value');

                        var minTexts = minValue.selectAll('text')
                            .data(function (d) {
                                return d.values;
                            });

                        minTexts.enter().append('text')
                            .attr('class', 'text');

                        minTexts.exit().remove();

                        minTexts.attr('x', function (d, i) {
                            return x.rangeBand() * i + x.rangeBand() / 2;
                        })
                            .attr('y', function (d) {
                                return y(d.tmn);
                            })
                            .attr('dy', margin.bottom)
                            .attr('text-anchor', 'middle')
                            .text(function (d) {
                                return Math.round(d.tmn) + '˚';
                            })
                            .attr('class', 'text-today')
                            .attr('y', function (d) {
                                return y(d.tmn);
                            });

                        // draw point
                        var circle = svg.selectAll('circle')
                            .data(data)
                            .enter().append('circle');

                        svg.selectAll('circle')
                            .data(data)
                            .attr('class', 'circle circle-today-current')
                            .attr('cx', function (d) {
                                for (var i = 0; i < d.values.length; i++) {
                                    if (d.values[i].fromToday === 0) {
                                        return x.rangeBand() * i + x.rangeBand() / 2;
                                    }
                                }
                                return 0;
                            })
                            .attr('cy', function (d) {
                                return y(d.temp);
                            })
                            .attr('r', 0)
                            .attr('r', 5);
                    };

                    scope.$watch('dayWidth', function(newValue) {
                        if (newValue == undefined || newValue == width) {
                            console.log('new value is undefined or already set same width='+width);
                            return;
                        }

                        width = newValue;
                        x = d3.scale.ordinal().rangeBands([margin.left, width - margin.right]);
                        if (svg) {
                            svg.attr('width', width);
                        }
                    });

                    scope.$watch('dayChart', function (newVal) {
                        if (newVal) {
                            console.log("update dayChart");
                            margin.top = marginTop + scope.getMidTableHeight(displayItemCount);
                            y = d3.scale.linear().range([height - margin.bottom, margin.top]);
                            chart();
                        }
                    });

                    scope.$watch('forecastType', function (newVal) {
                        if (newVal === false) {
                            console.log("change forecastType");
                            chart();
                        }
                    });
                }
            };
        });

        // Ionic uses AngularUI Router which uses the concept of states
        // Learn more here: https://github.com/angular-ui/ui-router
        // Set up the various states which the app can be in.
        // Each state's controller can be found in controllers.js
        $stateProvider
            .state('guide', {
                url: '/guide',
                cache: false,
                templateUrl: 'templates/guide.html',
                controller: 'GuideCtrl'
            })
            .state('purchase', {
                url: '/purchase',
                templateUrl: 'templates/purchase.html',
                controller: "PurchaseCtrl"
            })
            // setup an abstract state for the tabs directive
            .state('tab', {
                url: '/tab',
                abstract: true,
                templateUrl: 'templates/tabs.html',
                controller: 'TabCtrl'
            })

            // Each tab has its own nav history stack:
            .state('tab.search', {
                url: '/search',
                cache: false,
                views: {
                    'tab-search': {
                        templateUrl: 'templates/tab-search.html',
                        controller: 'SearchCtrl'
                    }
                }
            })
            .state('tab.forecast', {
                url: '/forecast?fav',
                cache: false,
                views: {
                    'tab-forecast': {
                        templateUrl: 'templates/tab-forecast.html',
                        controller: 'ForecastCtrl'
                    }
                }
            })
            .state('tab.dailyforecast', {
                url: '/dailyforecast?fav',
                cache: false,
                views: {
                    'tab-dailyforecast': {
                        templateUrl: 'templates/tab-dailyforecast.html',
                        controller: 'ForecastCtrl'
                    }
                }
            })
            .state('tab.setting', {
                url: '/setting',
                cache: true,
                views: {
                    'tab-setting': {
                        templateUrl: 'templates/tab-setting.html',
                        controller: 'SettingCtrl'
                    }
                }
            });

        // if none of the above states are matched, use this as the fallback
        $urlRouterProvider.otherwise('tab/forecast');

        $ionicConfigProvider.tabs.style('standard');
        $ionicConfigProvider.tabs.position('bottom');

        $ionicConfigProvider.views.transition("android");

        // Enable Native Scrolling on Android
        $ionicConfigProvider.platform.android.scrolling.jsScrolling(false);
        $ionicConfigProvider.platform.ios.scrolling.jsScrolling(false);

        var timePickerObj = {
            format: 12,
            step: 5,
            setLabel: '설정',
            cancelLabel: '삭제',
            closeLabel: '닫기',
            buttons: 3
        };
        ionicTimePickerProvider.configTimePicker(timePickerObj);
    })
    .constant('$ionicLoadingConfig', {
        template: '<ion-spinner icon="bubbles" class="spinner-stable"></ion-spinner>'
    });
