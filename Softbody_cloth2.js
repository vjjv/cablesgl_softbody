var exec=op.inTrigger("Exec");
var geometry=op.inObject("Geometry");
var nCol=op.inValueInt("nCol",20);
var nRow=op.inValueInt("nRow",20);
var doRender=op.inValueBool("Render",true);
var inMass=op.inValue("Mass",0.5);
var posX=op.inValue("Pos X",0);
var posY=op.inValue("Pos Y",5);
var posZ=op.inValue("Pos Z",0);
var sizeX=op.inValue("sizeX",10);
var sizeY=op.inValue("sizeY",10);
var inReset=op.inTriggerButton("Reset");
var width=op.inValue("width",1);
var height=op.inValue("height",1);

var geom=new CGL.Geometry('rectangle');
var next=op.outTrigger("Next");
var geomOut=op.outObject("geometry");
geomOut.ignoreValueSerialize=true;

var cgl=op.patch.cgl;
var m=null;
var bodies= [];
var mesh=null;
var newPos = [];

exec.onTriggered=render;

var needSetup=true;
var body=null;
var world=null;


inMass.onChange=setup;
posX.onChange=setup;
posY.onChange=setup;
posZ.onChange=setup;
nCol.onChange=setup;
nRow.onChange=setup;

sizeX.onChange=setup;
sizeY.onChange=setup;


var lastWorld=null;
var collided=false;

geometry.onChange=setup;

inReset.onTriggered=function()
{
    needSetup=true;
    setup();
    for(var i=0;i<bodies.length;i++){
        world.remove(bodies[i]);
    }
};

function buildRectangle(){

}

function setup()
{
    op.log("setup entered");


    ///////////////////////////////////////

    var w=10;//width.get();
    var h=10;//height.get();
    var x=0;
    var y=0;

    if(typeof w=='string')w=parseFloat(w);
    if(typeof h=='string')h=parseFloat(h);



    var verts=[];
    var tc=[];
    var norms=[];
    var tangents=[];
    var biTangents=[];
    var indices=[];

    var numRows=Math.round(nRow.get());
    var numColumns=Math.round(nCol.get());

    var stepColumn=w/numColumns;
    var stepRow=h/numRows;

    var c,r,a;
    a='xy';
    for(r=0;r<=numRows;r++)
    {
        for(c=0;c<=numColumns;c++)
        {
            verts.push( c*stepColumn - width.get()/2+x );
            if(a=='xz') verts.push( 0.0 );
            verts.push( r*stepRow - height.get()/2+y );
            if(a=='xy') verts.push( 0.0 );

            tc.push( c/numColumns );
            tc.push( 1.0-r/numRows );

            if(a=='xz')
            {
                norms.push(0,1,0);
                tangents.push(1,0,0);
                biTangents.push(0,0,1);
            }
            else if(a=='xy')
            {
                norms.push(0,0,1);
                tangents.push(-1,0,0);
                biTangents.push(0,-1,0);
            }
        }
    }

    for(c=0;c<numColumns;c++)
    {
        for(r=0;r<numRows;r++)
        {
            var ind = c+(numColumns+1)*r;
            var v1=ind;
            var v2=ind+1;
            var v3=ind+numColumns+1;
            var v4=ind+1+numColumns+1;

            indices.push(v1);
            indices.push(v3);
            indices.push(v2);

            indices.push(v2);
            indices.push(v3);
            indices.push(v4);
        }
    }

    geom.clear();
    geom.vertices=verts;
    geom.texCoords=tc;
    geom.verticesIndices=indices;
    geom.vertexNormals=norms;
    geom.tangents=tangents;
    geom.biTangents=biTangents;

    if(numColumns*numRows>64000)geom.unIndex();

    if(!mesh) mesh=new CGL.Mesh(cgl,geom);
        else mesh.setGeom(geom);

    geomOut.set(null);
    geomOut.set(geom);

    ///////////////////////////////////////

    if(geom)
    {
        op.log("geom rect ok");

        //if(!mesh) mesh=new CGL.Mesh(cgl,geom);
        //else mesh.setGeom(geom);
        //geomOut.set(null);
        //geomOut.set(geom);

        world=cgl.frameStore.world;
        if(!world)return;
        if(body)world.removeBody(body);


        var nCols=nCol.get();
        var nRows=nRow.get();
        op.log(nCols,nRows,geom.vertices[4]);

        var dist = 0.5;
        var mass = inMass.get();
        var bodiesConstr = {}; // bodies["i j"] => particle



        for(var i=0;i<geom.vertices.length;i=i+3){
            var curColl = Math.trunc((i/3)%(nCols+1));
            var curRoww = Math.trunc((i/3)/(nCols+1));
            var body = new CANNON.Body({ mass: curRoww==nRows ? 0 : mass });
            body.addShape(new CANNON.Particle());
            body.position.set(geom.vertices[i]+posX.get(),geom.vertices[i+1]+posY.get(),geom.vertices[i+2]+posZ.get());
            body.velocity.set(0, 3*(Math.sin(curColl*0.1)+Math.sin(curRoww*0.1)),0);
            world.add(body);
            bodies.push(body);
            bodiesConstr[curColl+" "+curRoww] = body;
        }

        function connect(i1,j1,i2,j2){
          world.addConstraint(new CANNON.DistanceConstraint(bodiesConstr[i1+" "+j1],bodiesConstr[i2+" "+j2],dist));
        }
        for(var i=0; i<nCols+1; i++){
            for(var j=0; j<nRows+1; j++){
                if(i<nCols) connect(i,j,i+1,j);
                if(j<nRows) connect(i,j,i,j+1);
            }
        }
    }
    needSetup=false;
    op.log("insetup",needSetup);
    lastWorld=world;
}


function render()
{
    //op.log("inrender1",needSetup);
    if(needSetup)setup();
    //op.log("inrender2",needSetup);
    //var geom=geometry.get();
    if(world!=cgl.frameStore.world);//needSetup=true;
    newPos.length = 0;
    if(geom){
        for(var i=0;i<bodies.length;i++){
            newPos.push(bodies[i].position["x"]);
            newPos.push(bodies[i].position["y"]);
            newPos.push(bodies[i].position["z"]);
        }
        op.log("newPos :",newPos);
        geom.setVertices(newPos);
        //geomOut.set(geom);

        if(!mesh) {
            mesh=new CGL.Mesh(cgl,geom);
        }
        else {
            mesh.updateVertices(geom);
            mesh.render(cgl.getShader());
            next.trigger();
        }
    }
    //if(!CGL.TextureEffect.checkOpNotInTextureEffect(op)) return;
}

