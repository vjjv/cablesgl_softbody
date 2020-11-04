var exec=op.inTrigger("Exec");
var geometry=op.inObject("Geometry");
var doRender=op.inValueBool("Render",true);
var inMass=op.inValue("Mass",0.5);
var posX=op.inValue("Pos X",0);
var posY=op.inValue("Pos Y",5);
var posZ=op.inValue("Pos Z",0);
var yLimitUp=op.inValue("Fixed points Up (Y limit)",0.5);
var yLimitDown=op.inValue("Fixed points Dowm (Y limit)",-0.5);
var sDamping=op.inValue("Spring Damping",1);
var sStiffness=op.inValue("Spring Stiffness",50);
var inReset=op.inTriggerButton("Reset");


var next=op.outTrigger("Next");
var geomOut=op.outObject("geometry");
geomOut.ignoreValueSerialize=true;

var geom = null;
var cgl=op.patch.cgl;
var m=null;
var bodies= [];
var newIndices=[];
var indexingMap= new Map();
var particlesMap=new Map();
var bodiesMap=new Map();
var springsMap = new Map();
var mesh=null;
var newPos = [];
var springs=[];
var newVertices=[];

exec.onTriggered=render;

var needSetup=true;
var body=null;
var world=null;


inMass.onChange=setup;
posX.onChange=setup;
posY.onChange=setup;
posZ.onChange=setup;
yLimitUp.onChange=setup;
yLimitDown.onChange=setup;
sDamping.onChange=setup;
sStiffness.onChange=setup;


var lastWorld=null;
var collided=false;

geometry.onChange=setup;

inReset.onTriggered=function()
{
    for(var value of bodiesMap.values()){
        world.remove(value);
    }
    needSetup=true;
    indexingMap.clear();
    particlesMap.clear();
    bodiesMap.clear();
    mesh=null;
    newPos.length=0;
    newIndices.length=0;
};


function getDistance( x1,y1,z1, x2,y2,z2)
{
    var dx = x1 - x2;
    var dy = y1 - y2;
    var dz = z1 - z2;

    return Math.sqrt( dx * dx + dy * dy + dz * dz );
}

function getMin( tab )
{
    var min=tab[0]
    for(var i=0; i<tab.length; i++)
        if(tab[i]<min)
            min=tab[i];
    return min;

}


function setup()
{

    for(var value of bodiesMap.values()){
        world.remove(value);
    }
    needSetup=true;
    indexingMap.clear();
    particlesMap.clear();
    bodiesMap.clear();
    mesh=null;
    newPos.length=0;
    newVertices.length=0;
    newIndices.length=0;
    geom = null;
    geom=geometry.get();
    if(!geom)return;

    geomOut.set(null);
    geomOut.set(geom);

    world=cgl.frameStore.world;

    if(!world)return;
    if(body)world.removeBody(body);

    var mass = inMass.get();

    var exist=false;
    var kParticles;

    var curX,curY,curZ,pos;


    //indexing vertices that are recreated in cables
    for(var i=0; i<geom.vertices.length;i=i+3){
        curX=geom.vertices[i];
        curY=geom.vertices[i+1];
        curZ=geom.vertices[i+2];
        pos = {x:curX, y:curY, z:curZ};
        op.log('geom.vertices i',i/3,curX,curY,curZ);

        exist=false;
        for(var [key,value] of particlesMap.entries()){

            if(value.x==curX && value.y ==curY && value.z ==curZ ){
                exist=true;
                kParticles=key;
                break;
            }
        }
        if(exist){
            indexingMap.set(i/3,indexingMap.get(kParticles));
            indexingMap.get(kParticles).push(i/3) ;
        }
        else{
            particlesMap.set(i/3, {x:curX, y:curY, z:curZ});
            indexingMap.set(i/3,[i/3]);
        }
    }


    //display indexingMap and particlesMap
    op.log("indexingMap :",indexingMap);
    op.log("particlesMap :",particlesMap);


    //listing a new verticesIndices with indexed vertices
    for(var i=0;i<geom.verticesIndices.length;i++){
        var key=geom.verticesIndices[i];
        var value= indexingMap.get(geom.verticesIndices[i]);
        var min= getMin(value);
        newIndices.push(min);
    }
    op.log("new indices from VertIndices: ",newIndices);



    //add new CANNON.body to the world
    for(var[key,value] of particlesMap.entries()){
        var body = new CANNON.Body({ mass : value.y>yLimitUp.get()||value.y<yLimitDown.get() ? 0 : mass });
        body.addShape(new CANNON.Particle());
        body.position.set(value.x+posX.get(),value.y+posY.get(),value.z+posZ.get());
        body.velocity.set(0,0,0);
        world.add(body);
        bodiesMap.set(key,body);
    }
    op.log("bodies : ",bodiesMap);


    //connect the bodies with the right distance
    op.log('newIndices.length :',newIndices.length, newIndices);

    var bodyBase = new CANNON.Body({ mass : 0 });
        bodyBase.addShape(new CANNON.Particle());
        bodyBase.position.set(0.35,5,0.35);
        bodyBase.velocity.set(0,0,0);
        world.add(bodyBase);

    for(var i=0;i<newIndices.length;i=i+3){
        var body0=bodiesMap.get(newIndices[i]);
        var body1=bodiesMap.get(newIndices[i+1]);
        var body2=bodiesMap.get(newIndices[i+2]);
        op.log('connect : (i)',i,newIndices[i],newIndices[i+1],newIndices[i+2]);
        var dist0= getDistance(body0.position.x,body0.position.y,body0.position.z, body1.position.x, body1.position.y, body1.position.z);
        var dist1= getDistance(body1.position.x,body1.position.y,body1.position.z, body2.position.x, body2.position.y, body2.position.z);
        var dist2= getDistance(body2.position.x,body2.position.y,body2.position.z, body0.position.x, body0.position.y, body0.position.z);

        if(!alreadyConnected(body0,body1)){
            connect(body0,body1, dist0, newIndices[i]);
            connect(body1,body2, dist1, newIndices[i+1]);
            connect(body2,body0, dist2, newIndices[i+2]);
            connectConstr(body0,body1, dist0);
            connectConstr(body1,body2, dist1);
            connectConstr(body2,body0, dist2);

        }


        var tab = [];
        tab.push(newIndices[i]);
        tab.push(newIndices[i+1]);
        springs.push(tab);


        var damping=sDamping.get();//1
        var stiffness=sStiffness.get();//50
    }





    function connectConstr(body1, body2, distance){
        world.addConstraint(new CANNON.DistanceConstraint(body1,body2,distance));
    }

    function alreadyConnected(k1,k2){
        for(var i=0; i<springs.length;i++){
            var tab= springs[i];
            if((tab[0]==k1 && tab[1]==k2)||(tab[0]==k2 && tab[1]==k1)){
                return true;
            }else return false;
        }
    }

    function connect(body1, body2, distance, i){

        var spring = new CANNON.Spring(body1, body2, {
            restLength: distance,
            stiffness: stiffness,
            damping: damping,
            localAnchorA: new CANNON.Vec3(0,0,0),
            localAnchorB: new CANNON.Vec3(particlesMap.get(i).x,particlesMap.get(i).y,particlesMap.get(i).z),
        });


        world.addEventListener("postStep", function(event) {
          spring.applyForce();
        });

    }




    for(var i=0;i<geom.vertices.length;i=i+3){
        var min = getMin(indexingMap.get(i/3));
        op.log('length', length, 'min', min);
        newVertices.push(min);
    }


    needSetup=false;
    lastWorld=world;


}


function render()
{

    if(world!=cgl.frameStore.world)needSetup=true;
    if(needSetup)setup();

    newPos.length = 0;
    if(!geom)return;

    for(var i=0, il=newVertices.length;i<il;i++){
        newPos.push(bodiesMap.get(newVertices[i]).position["x"]);
        newPos.push(bodiesMap.get(newVertices[i]).position["y"]);
        newPos.push(bodiesMap.get(newVertices[i]).position["z"]);
    }

    geom.setVertices(newPos);
    geomOut.set(geom);
    if(!mesh) {
        mesh=new CGL.Mesh(cgl,geom);
    }
    else {
        mesh.updateVertices(geom);
        mesh.render(cgl.getShader());
        next.trigger();
    }

}

