L.GeoTime = L.Class.extend({
    statics: {},
    options: {
        map: {},
        duration: 1000
    },
    initialize: function (geoJSON, options) {

        L.setOptions(this, options);

        this._map = this.options.map || {};
        this._duration = this.options.duration || {};
        this._geos = this._geos || [];
        this._features = this._features || [];
        this._ticks = [];
        this._tick = this._tick || 1;
        this._featureGroup = this._featureGroup || {};
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
        var lab = document.getElementById('lab');
        lab.innerHTML = this._geos[0].properties.time[0][0];

        for (var i = 0, len = this._geos.length; i < len; i++) {
            var geometry = this._geos[i].geometry,
                props = this._geos[i].properties;
            this._ticks.push(props.time.length);
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
            this._duration,
            this
        );
    },
    _animation: function (self) {
        var lab = document.getElementById('lab');
        if (self._tick >= Math.max.apply(null, self._ticks)) {
            clearInterval(self._intervalID);
            return;
        }
        for (var i = 0, len = self._features.length; i < len; i++) {
            if (self._tick >= self._geos[i].properties.time.length) {
                continue;
            }
            if (self._features[i].options.type == "Line") {
                self._features[i].setStyle({
                    color: self._getColor(self._geos[i].properties.time[self._tick][1])
                })
            } else {
                self._features[i].setStyle({
                    fillColor: self._getColor(self._geos[i].properties.time[self._tick][1])
                })
            }
            lab.innerHTML = self._geos[i].properties.time[self._tick][0];
        }
        self._tick++;
    },

    _speedUp: function () {
        this._duration = this._duration + 1000;
        document.getElementById('speed').value = this._duration;

        if (this._intervalID) {
            this.stop();
            this.start();
        }
    },

    _speedDown: function () {
        if (this._duration > 1000) {
            this._duration = this._duration - 1000;
        } else {
            if (this._duration > 100)
                this._duration = this._duration - 100;
            else {
                this._duration = 100;
            }
        }
        document.getElementById('speed').value = this._duration;

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
