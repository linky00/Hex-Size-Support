Hooks.on("renderTokenConfig", async (app, html) => {
	let flags = {
		altSnapping: app.token.getFlag("hex-size-support","altSnapping") || false,
		evenSnap: app.token.getFlag("hex-size-support","evenSnap") || false
	}
	const positionTab = html.find('.tab[data-tab="position"]');
	positionTab.append($(`
		<fieldset class="auras">
				<legend>Hex Size Support</legend>
				<ol class="form-group">
					<li class="flexrow">
						<label class="checkbox">
							Use Alternative Snapping
							<input type="checkbox" name="flags.hex-size-support.altSnapping"
							       ${flags.altSnapping ? 'checked' : ''}>
						</label>
						<label class="checkbox">
							Use even snapping(Snapping for sizes 2,4,6, etc)
							<input type="checkbox" name="flags.hex-size-support.evenSnap"
							       ${flags.evenSnap ? 'checked' : ''}>
						</label>
					</li>
				</ol>
			</fieldset>
		`));
});

Token.prototype.refresh = (function () {
	const cached = Token.prototype.refresh;
	return function () {
		if(this.getFlag("hex-size-support","evenSnap") == true){
			this.icon.pivot.y = -(canvas.grid.grid.h * 0.125 * 2);
		}
		const p = cached.apply(this, arguments);
		return p;
	};
})();

Token.prototype._cachedonDragLeftDrop = Token.prototype._onDragLeftDrop;
Token.prototype._onDragLeftDrop = function(event) {
	console.log(this)

	let altSnapping = this.getFlag("hex-size-support", "altSnapping");
	if(altSnapping == true){
		const clones = event.data.clones || [];
	    const {originalEvent, destination} = event.data;

	    // Ensure the destination is within bounds
	    if ( !canvas.grid.hitArea.contains(destination.x, destination.y) ) return false;

	    // Compute the final dropped positions
	    const updates = clones.reduce((updates, c) => {

	      // Get the snapped top-left coordinate
	      let dest = {x: c.data.x, y: c.data.y};

	      if (!originalEvent.shiftKey) {
	      	let evenSnapping = this.getFlag("hex-size-support", "evenSnap");
	      	if(evenSnapping == false){
	      		dest = this.oddSnap(dest);
	      	}
	      	else{
	      		dest = this.evenSnap(dest);
	      	}
	      }

	      // Test collision for each moved token vs the central point of it's destination space
	      if ( !game.user.isGM ) {
	        let target = c.getCenter(dest.x, dest.y);
	        let collides = c.checkCollision(target);
	        if ( collides ) {
	          ui.notifications.error(game.i18n.localize("ERROR.TokenCollide"));
	          return updates
	        }
	      }

	      // Perform updates where no collision occurs
	      updates.push({_id: c._original.id, x: dest.x, y: dest.y});
	      return updates;
	    }, []);
	    return canvas.scene.updateEmbeddedEntity(this.constructor.name, updates);
	}
	else {
		this._cachedonDragLeftDrop(event);
	}
}

Token.prototype.oddSnap = function(dest){
    //offset values for the center of the tile
    //ex, top left + offset.x is the x coordinate of the center of the token
    let offset = {
    	x: (this.w) / 2,
		y: (this.h) / 2
    }

    //get coordinates of the center snap point
    let center = canvas.grid.getCenter(dest.x + offset.x, dest.y + offset.y);


    //set the pivot to zero to ensure that pivot is changed correctly if a token is changed from
    //even snapping to odd snapping
	this.icon.pivot.y = 0;

    //remove the offset from the newly discovered true center and store
    return {
    	x: center[0] - offset.x,
    	y: center[1] - offset.y
    }
}

Token.prototype.evenSnap = function(dest){
    //offset values for the center of the tile
    //ex, top left + offset.x is the x coordinate of the center of the token
    let offset = {
    	x: (this.w) / 2,
		y: (this.h) / 2
    }

    let tokenCenter = {
    	x: dest.x + offset.x,
    	y: dest.y + offset.y
    }
	let snappedCenter = {x: 0, y: 0};
    //get coordinates of the center snap point
    [snappedCenter.x, snappedCenter.y] = canvas.grid.getCenter(tokenCenter.x, tokenCenter.y);

    console.log(tokenCenter)
    console.log(snappedCenter)

    //calculate the slope of the line drawn between the tokens center and the actual grid's center
    let slope = -(tokenCenter.y - snappedCenter.y) / (tokenCenter.x - snappedCenter.x)
    
    //we use the slope of this line to determine the section of the hex we are in. The hex is divided up
    //evenly into 6 sections from the center. A line with slope of around 1.732 has an angle from the x axis of about
    //60 degrees, so we use that to determine roughly which angle we are in.

    let vertexOffset = {x:0, y:0}

    let sector = -1;
    const columns = canvas.grid.grid.columns;
    if(columns){
    	sector = findSectorFlat(tokenCenter.x > snappedCenter.x, slope);
    }
    else
    {
    	sector = findSectorPointy(tokenCenter.y < snappedCenter.y, slope);
	}

    vertexOffset = vertexFind(sector, canvas.grid.grid.w, canvas.grid.grid.h, columns);

    //set the pivot here in addition to when the canvas is rendered
    //this is to ensure the pivot change happens after a token is changed and moved
    this.icon.pivot.y = -(canvas.grid.grid.h * 0.125 * 2);
    //remove the offset from the newly discovered true center and store
    return {
    	x: snappedCenter.x - offset.x + vertexOffset.x,
    	y: snappedCenter.y - offset.y + vertexOffset.y //+ (canvas.grid.grid.h * 0.125)
    }
}

function findSectorPointy(above, slope){
	if(above){
    	if(slope > 0 && slope < 1.732){
			console.log("hex 3");
			return 3;
    	}
    	else if(slope < 0 && slope > -1.732){
    		console.log("Hex 1");
    		return 1;
    	}
    	else{
    		console.log("Hex 2");
    		return 2;
    	}
    }
    else{
    	if(slope > 0 && slope < 1.732){
			console.log("Hex 6");
			return 6;
    	}
    	else if(slope < 0 && slope > -1.732){
    		console.log("Hex 4")
    		return 4;
    	}
    	else{
    		console.log("Hex 5")
    		return 5;
    	}
    }
}

function findSectorFlat(right, slope){
	if(right){
    	if(slope > 0.577){
			console.log("hex 3");
			return 3;
    	}
    	else if(slope < -0.577){
    		console.log("Hex 5");
    		return 5;
    	}
    	else{
    		console.log("Hex 4");
    		return 4;
    	}
    }
    else{
    	if(slope > 0.577){
			console.log("hex 6");
			return 6;
    	}
    	else if(slope < -0.577){
    		console.log("Hex 2");
    		return 2;
    	}
    	else{
    		console.log("Hex 1");
    		return 1;
    	}
    }
}

let pointHexVertexScalar = [
	[-0.5, -0.25], 
	[0, -0.5], 
	[0.5, -0.25], 
	[0.5, 0.25], 
	[0, 0.5], 
	[-0.5, 0.25]
	];

let flatHexVertexScalar = [
	[-0.5, 0], 
	[-0.25, -0.5], 
	[0.25, -0.5], 
	[0.5, 0], 
	[0.25, 0.5], 
	[-0.25, 0.5]];


//calculate the offset to get to the vertex in the given region given the
//width and height of a hex in this scene and if the scene has pointy/flat topped hexes
function vertexFind(region, width, height, flatHex ){
	if(flatHex){
		return {
			x: flatHexVertexScalar[region - 1][0] * width,
			y: flatHexVertexScalar[region - 1][1] * height
		}
	}
	else{
		return {
			x: pointHexVertexScalar[region - 1][0] * width,
			y: pointHexVertexScalar[region - 1][1] * height
		}
	}
}
