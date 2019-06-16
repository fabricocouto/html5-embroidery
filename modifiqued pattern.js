(function(global) {
    "use strict";

    function Stitch(x, y, flags, color) {
        this.flags = flags;
        this.x = x;
        this.y = y;
        this.color = color;
    }

    function Color(r, g, b, description) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.description = description;
    }

    function rgbToHex(color) {
        return "#" + componentToHex(color.r) + componentToHex(color.g) + componentToHex(color.b);
    }

    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    function shadeColor(color, percent) { // deprecated. See below.
        var num = parseInt(color.slice(1), 16),
            amt = Math.round(2.55 * percent),
            R = (num >> 16) + amt,
            G = (num >> 8 & 0x00FF) + amt,
            B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    var stitchTypes = {
        normal: 0,
        jump: 1,
        trim: 2,
        stop: 4,
        end: 8
    };

    function Pattern() {
        this.colors = [];
        this.stitches = [];
        this.hoop = {};
        this.lastX = 0;
        this.lastY = 0;
        this.top = 0;
        this.bottom = 0;
        this.left = 0;
        this.right = 0;
        this.currentColorIndex = 0;
    }

    Pattern.prototype.addColorRgb = function(r, g, b, description) {
        this.colors[this.colors.length] = new Color(r, g, b, description);
    };

    Pattern.prototype.addColor = function(color) {
        this.colors[this.colors.length] = color;
    };

    Pattern.prototype.addStitchAbs = function(x, y, flags, isAutoColorIndex) {
        if ((flags & stitchTypes.end) === stitchTypes.end) {
            this.calculateBoundingBox();
            this.fixColorCount();
        }
        if (((flags & stitchTypes.stop) === stitchTypes.stop) && this.stitches.length === 0) {
            return;
        }
        if (((flags & stitchTypes.stop) === stitchTypes.stop) && isAutoColorIndex) {
            this.currentColorIndex += 1;
        }
        this.stitches[this.stitches.length] = new Stitch(x, y, flags, this.currentColorIndex);
    };

    Pattern.prototype.addStitchRel = function(dx, dy, flags, isAutoColorIndex) {
        if (this.stitches.length !== 0) {
            var nx = this.lastX + dx,
                ny = this.lastY + dy;
            this.lastX = nx;
            this.lastY = ny;
            this.addStitchAbs(nx, ny, flags, isAutoColorIndex);
        } else {
            this.addStitchAbs(dx, dy, flags, isAutoColorIndex);
        }
    };

    Pattern.prototype.calculateBoundingBox = function() {
        var i = 0,
            stitchCount = this.stitches.length,
            pt;
        if (stitchCount === 0) {
            this.bottom = 1;
            this.right = 1;
            return;
        }
        this.left = 99999;
        this.top = 99999;
        this.right = -99999;
        this.bottom = -99999;

        for (i = 0; i < stitchCount; i += 1) {
            pt = this.stitches[i];
            if (!(pt.flags & stitchTypes.trim)) {
                this.left = this.left < pt.x ? this.left : pt.x;
                this.top = this.top < pt.y ? this.top : pt.y;
                this.right = this.right > pt.x ? this.right : pt.x;
                this.bottom = this.bottom > pt.y ? this.bottom : pt.y;
            }
        }
    };

    Pattern.prototype.moveToPositive = function() {
        var i = 0,
            stitchCount = this.stitches.length;
        for (i = 0; i < stitchCount; i += 1) {
            this.stitches[i].x -= this.left;
            this.stitches[i].y -= this.top;
        }
        this.right -= this.left;
        this.left = 0;
        this.bottom -= this.top;
        this.top = 0;
    };

    Pattern.prototype.invertPatternVertical = function() {
        var i = 0,
            temp = -this.top,
            stitchCount = this.stitches.length;
        for (i = 0; i < stitchCount; i += 1) {
            this.stitches[i].y = -this.stitches[i].y;
        }
        this.top = -this.bottom;
        this.bottom = temp;
    };

    Pattern.prototype.addColorRandom = function() {
        this.colors[this.colors.length] = new Color(Math.round(Math.random() * 256), Math.round(Math.random() * 256), Math.round(Math.random() * 256), "random");
    };

    Pattern.prototype.fixColorCount = function() {
        var maxColorIndex = 0,
            stitchCount = this.stitches.length,
            i;
        for (i = 0; i < stitchCount; i += 1) {
            maxColorIndex = Math.max(maxColorIndex, this.stitches[i].color);
        }
        while (this.colors.length <= maxColorIndex) {
            this.addColorRandom();
        }
        this.colors.splice(maxColorIndex + 1, this.colors.length - maxColorIndex - 1);
    };

    Pattern.prototype.drawShape = function(canvas) {
        canvas.width = this.right;
        canvas.height = this.bottom;
        var gradient, lastStitch = this.stitches[0],
            tx, ty, angle = 0,
            gWidth = 100,
            gHeight = 100;
        if (canvas.getContext) {
            var ctx = canvas.getContext('2d');
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            var color = this.colors[this.stitches[0].color];
            for (var i = 0; i < this.stitches.length; i++) {
                var currentStitch = this.stitches[i];
                if (i > 0)
                    lastStitch = this.stitches[i - 1];
                tx = currentStitch.x - lastStitch.x;
                ty = currentStitch.y - lastStitch.y;
                gWidth = Math.sqrt(tx * tx + ty * ty);
                angle = Math.atan2(ty, tx);
                gradient = ctx.createRadialGradient(currentStitch.x - tx, currentStitch.y - ty, 0, currentStitch.x - tx, currentStitch.y - ty, gWidth * 1.4);
                gradient.addColorStop("0", shadeColor(rgbToHex(color), -60));
                gradient.addColorStop("0.05", rgbToHex(color));
                gradient.addColorStop("0.5", shadeColor(rgbToHex(color), 60));
                gradient.addColorStop("0.9", rgbToHex(color));
                gradient.addColorStop("1.0", shadeColor(rgbToHex(color), -60));
                ctx.strokeStyle = gradient;
                if (currentStitch.flags === stitchTypes.jump || currentStitch.flags === stitchTypes.trim || currentStitch.flags === stitchTypes.stop) {
                    var color = this.colors[currentStitch.color];
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(" + color.r + "," + color.g + "," + color.b + ",0)";
                    ctx.moveTo(currentStitch.x, currentStitch.y);
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.moveTo(lastStitch.x, lastStitch.y);
                ctx.lineTo(currentStitch.x, currentStitch.y);
                ctx.stroke();
                lastStitch = currentStitch;
            }

        } else {
            global.alert('You need Safari or Firefox 1.5+ to see this demo.');
        }
    }

    global.Color = Color.prototype.constructor;
    global.Pattern = Pattern.prototype.constructor;
    global.stitchTypes = stitchTypes;

}(this));
