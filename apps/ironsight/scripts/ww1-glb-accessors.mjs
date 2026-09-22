const COMPONENTS = Object.freeze({
  5120: { bytes: 1, read: "readInt8", normalize: (value) => Math.max(value / 127, -1) },
  5121: { bytes: 1, read: "readUInt8", normalize: (value) => value / 255 },
  5122: { bytes: 2, read: "readInt16LE", normalize: (value) => Math.max(value / 32767, -1) },
  5123: { bytes: 2, read: "readUInt16LE", normalize: (value) => value / 65535 },
  5125: { bytes: 4, read: "readUInt32LE" }, 5126: { bytes: 4, read: "readFloatLE" },
});
const WIDTHS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });

function issue(code, path, detail) {
  return detail === undefined ? { code, path } : { code, path, detail };
}

export function accessorData(document, binary, index, issues) {
  const accessor = document.accessors?.[index];
  const view = accessor && Number.isSafeInteger(accessor.bufferView) ? document.bufferViews?.[accessor.bufferView] : undefined;
  const component = accessor && COMPONENTS[accessor.componentType];
  const width = accessor && WIDTHS[accessor.type];
  if (!Number.isSafeInteger(index) || !accessor || !view || !component || !width || view.buffer !== 0 || !Number.isSafeInteger(accessor.count) || accessor.count < 0) {
    issues.push(issue("invalid_accessor", `accessors[${index}]`));
    return { values: [], count: 0, width: 0, type: undefined, componentType: undefined, normalized: false };
  }
  if (accessor.normalized === true && component.normalize === undefined) issues.push(issue("invalid_accessor", `accessors[${index}].normalized`));
  const elementBytes = component.bytes * width;
  const stride = view.byteStride ?? elementBytes;
  const viewStart = view.byteOffset ?? 0;
  const viewLength = view.byteLength;
  const accessorOffset = accessor.byteOffset ?? 0;
  if (![viewStart, viewLength, accessorOffset, stride].every((value) => Number.isSafeInteger(value) && value >= 0)
    || stride < elementBytes || stride % component.bytes !== 0 || accessorOffset % component.bytes !== 0
    || viewStart + viewLength > binary.length) {
    issues.push(issue("accessor_out_of_range", `accessors[${index}]`));
    return { values: [], count: accessor.count, width, type: accessor.type, componentType: accessor.componentType, normalized: accessor.normalized === true };
  }
  const requiredLength = accessor.count === 0 ? accessorOffset : accessorOffset + (accessor.count - 1) * stride + elementBytes;
  if (requiredLength > viewLength) {
    issues.push(issue("accessor_out_of_range", `accessors[${index}]`));
    return { values: [], count: accessor.count, width, type: accessor.type, componentType: accessor.componentType, normalized: accessor.normalized === true };
  }
  const start = viewStart + accessorOffset;
  const values = [];
  for (let element = 0; element < accessor.count; element += 1) {
    for (let lane = 0; lane < width; lane += 1) {
      const offset = start + element * stride + lane * component.bytes;
      const rawValue = binary[component.read](offset);
      const value = accessor.normalized === true && component.normalize ? component.normalize(rawValue) : rawValue;
      if (!Number.isFinite(value)) issues.push(issue("non_finite_accessor", `accessors[${index}]`, { element, lane }));
      values.push(value);
    }
  }
  return { values, count: accessor.count, width, type: accessor.type, componentType: accessor.componentType, normalized: accessor.normalized === true };
}

export function isSingularMatrix(values) {
  const rows = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => values[column * 4 + row]));
  for (let column = 0; column < 4; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 4; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (!Number.isFinite(rows[pivot][column]) || Math.abs(rows[pivot][column]) < 1e-10) return true;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = column + 1; row < 4; row += 1) {
      const scale = rows[row][column] / rows[column][column];
      for (let lane = column; lane < 4; lane += 1) rows[row][lane] -= scale * rows[column][lane];
    }
  }
  return false;
}
