/// <reference path="../libs/LeafletPlayback.js" />
L.GeoTime = L.Class.extend({
    statics: {},
    options: {
        map: {},
        duration: 1000
    },
    initialize: function (geoJSON, options) {

        L.setOptions(this, options);

        this._map = this.options.map || {};
        this._duration = this.options.duration || 1*60*1000;
        this._speed = this.options.speed || 1000;
        this._geos = this._geos || [];
        this._features = this._features || [];
        this._ticks = [];
        this._tick = this._tick || 1;
        this._featureGroup = this._featureGroup || {};
        this._earliestTime = this._earliestTime || 0;
        this._latestTime = this._latestTime || 0;
        this._tags = this._tags || [];
        this._initData(geoJSON);

        this.start = this._start || {};
        this.stop = this._stop || {};
        this.speedUp = this._speedUp || {};
        this.speedDown = this._speedDown || {};
        this.clearLayer = this._clearLayer || {};
    },

    _initData: function (geoJSON) {
        if (!geoJSON) {
            return;
        }
        for (var i = 0, len = geoJSON.features.length; i < len; i++) {
            this._geos.push(geoJSON.features[i]);
        }
        this._geoToLayer();
    },
    _geoToLayer: function () {
        for (var i = 0, len = this._geos.length; i < len; i++) {
            var geometry = this._geos[i].geometry,
                props = this._geos[i].properties;
            this._ticks.push(props.time.length);
            this._tags.push(0);
            this._initTime(props);
            switch (geometry.type) {
                case 'Point':
                    var marker = this._createMaker(geometry.coordinates, props.time[0][1], props.id);
                    this._features.push(marker)
                    break;
                case 'MultiPoint':
                    var makerGroup = [];
                    for (j = 0, len = geometry.coordinates.length; j < len; j++) {
                        var maker = this._createMaker(geometry.coordinates[j], props.time[0][1], props.id)
                        makerGroup.push(marker);
                    }
                    this._features.push(L.featureGroup(makerGroup));
                    break;
                case 'LineString':
                case 'MultiLineString':
                    var lines = L.polyline(this._coordsToLatLngs(geometry.coordinates, geometry.type === 'LineString' ? 0 : 1, this._coordsToLatLng), {
                        color: this._getColor(props.time[0][1]),
                        type: "Line",
                        id: props.id
                    });
                    this._features.push(lines);
                    break;
                case 'Polygon':
                case 'MultiPolygon':
                    var polygons = L.polygon(this._coordsToLatLngs(geometry.coordinates, geometry.type === 'Polygon' ? 1 : 2, this._coordsToLatLng), {
                        fillColor: this._getColor(props.time[0][1]),
                        weight: 2,
                        opacity: 1,
                        color: 'white',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        type: "Polygon",
                        id: props.id
                    });
                    this._features.push(polygons);
                    break;
                case 'GeometryCollection':
                    break;
                default:
                    throw new Error('Invalid GeoJSON object.');
            }
        }
        this._featureGroup = L.featureGroup(this._features).addTo(this._map);
        var lab = document.getElementById('lab');
        lab.innerHTML = new Date(this._earliestTime);
    },
    _coordsToLatLng: function (coords) {
        return new L.LatLng(coords[1], coords[0], coords[2]);
    },
    _coordsToLatLngs: function (coords, levelsDeep, coordsToLatLng) {
        var latlngs = [];
        for (var i = 0, len = coords.length, latlng; i < len; i++) {
            latlng = levelsDeep ?
                this._coordsToLatLngs(coords[i], levelsDeep - 1, coordsToLatLng) :
                (coordsToLatLng || this.coordsToLatLng)(coords[i]);
            latlngs.push(latlng);
        }
        return latlngs;
    },
    _createMaker: function (coords, val, id) {
        var marker = L.circleMarker(this._coordsToLatLng(coords), {
            radius: 8,
            fillColor: this._getColor(val),
            color: "white",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.7,
            dashArray: '1',
            type: "Point",
            id: id
        });
        return marker;
    },

    _getColor: function (index) {
        return index > 8 ? '#E41A16' :
            index > 6 ? '#F29618' :
                index > 4 ? '#ECE839' :
                    index > 2 ? '#6AB72D' :
                        '#36AE4C';
    },
    _initTime: function (props) {
        var time = this._geos[0].properties.time;
        this._earliestTime = time[0][0];
        this._latestTime = time[time.length - 1][0];
        if (props.time[0][0] < this._earliestTime) {
            this._earliestTime = props.time[0][0];
        }
        if (props.time[props.time.length - 1][0] > this._latestTime) {
            this._latestTime = props.time[props.time.length - 1][0];
        }
    },
    _isPlaying: function () {
        return this._intervalID ? true : false;
    },
    _start: function () {
        var btn = document.getElementById('btn');
        if (this._isPlaying()) {
            this._stopAnimation();
            btn.value = 'start';
        } else {
            this._startAnimation();
            btn.value = 'stop';
        }
    },
    _stop: function () {
        this._stopAnimation();
    },
    _stopAnimation: function () {
        if (!this._intervalID) return;
        window.clearInterval(this._intervalID);
        this._intervalID = null;
    },
    _startAnimation: function () {
        if (this._intervalID) return;
        this._intervalID = window.setInterval(
            this._animation,
            this._speed,
            this
        );
    },
    _animation: function (self) {
        var lab = document.getElementById('lab');
        if (self._latestTime < self._earliestTime + self._tick * self._duration) {
            clearInterval(self._intervalID);
            return;
        }
        for (var i = 0, len = self._features.length; i < len; i++) {
            if (self._geos[i].properties.time[self._geos[i].properties.time.length-1][0] < self._earliestTime + self._tick * self._duration) {
                continue;
            }
           
            if (self._features[i].options.type == "Line" && self._geos[i].properties.time[0] >= self._earliestTime + self._tick * self._duration) {
                self._features[i].setStyle({
                    color: self._getColor(self._geos[i].properties.time[self._tick][1])
                });
                self._tags[i] = self._tags[i] + 1;
            } else if (self._geos[i].properties.time[self._tags[i]+1][0] <= self._earliestTime + self._tick * self._duration) {
                self._features[i].setStyle({
                    fillColor: self._getColor(self._geos[i].properties.time[self._tags[i]+1][1])
                });
                self._tags[i] = self._tags[i] + 1;
                console.log(new Date(self._earliestTime + self._tick * self._duration));
                console.log("*****");
            }
            lab.innerHTML = new Date(self._earliestTime + self._tick * self._duration);
        }
        self._tick++;
    },

    _speedUp: function () {
        this._speed = this._speed + 1000;
        document.getElementById('speed').value = this._speed;

        if (this._intervalID) {
            this.stop();
            this.start();
        }
    },

    _speedDown: function () {
        if (this._speed > 1000) {
            this._speed = this._speed - 1000;
        } else {
            if (this._speed > 100)
                this._speed = this._speed - 100;
            else {
                this._speed = 100;
            }
        }
        document.getElementById('speed').value = this._speed;

        if (this._intervalID) {
            this.stop();
            this.start();
        }
    },

    _clearLayer: function () {
        this._stop();
        this._map.removeLayer(this._featureGroup);
    }
});

L.geoTime = function (geoJSON, options) {
    return new L.GeoTime(geoJSON, options);
}
