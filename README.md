# Cables.gl Softbody Ops
Softbody logic for Cables.gl using Cannon.js

Pass all the mesh vertices to cannon js to create rigid bodies with all of them.
Then add elastic constraint to keep them together.
(The face model is broken on the cables.gl link example, it's not due to the op algorithm, the input model is like that)


Please use them like the cables examples below :

- Softbody clothes : 'SoftbodyCloth2' op : https://cables.gl/p/8N6E-G

- Softbody mesh : 'SoftbodyTab_usingArrays' op : https://cables.gl/p/CRyNqC

- Softbody mesh : 'SoftbodyMesh_usingMaps' op : https://cables.gl/p/9VATXB

SoftbodyTab is a V2 of the SoftbodyMesh and store values in js arrays instead of js Maps, results faster.

Enjoy



