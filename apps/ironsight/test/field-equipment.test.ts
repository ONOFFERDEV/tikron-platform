import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { prepareRadioGeometry } from '../client/field-equipment.js';

describe('radio preparation', () => {
  it('fits transformed generated geometry once, preserving vertex colour and the source', () => {
    const asset=new T.Group(),source=new T.BoxGeometry(.3,.5,.2);
    source.setAttribute('color',new T.Float32BufferAttribute(Array(source.getAttribute('position').count*3).fill(.2),3));
    const mesh=new T.Mesh(source);mesh.position.set(1,.25,-1);asset.add(mesh);
    const original=Array.from(source.getAttribute('position').array);
    const part=prepareRadioGeometry(asset);part.computeBoundingBox();
    const size=part.boundingBox!.getSize(new T.Vector3());
    expect(size.x).toBeCloseTo(.26,6);expect(size.y).toBeCloseTo(.46,6);expect(size.z).toBeCloseTo(.18,6);
    expect(part.boundingBox!.getCenter(new T.Vector3()).length()).toBeLessThan(1e-6);
    expect(part.getAttribute('color').getX(0)).toBeCloseTo(.2,6);
    expect(Array.from(source.getAttribute('position').array)).toEqual(original);
    expect(part.index).toBeNull();
  });
});
