export class BinaryWriter {
  buffer: ArrayBuffer;
  view: DataView;
  offset: number;

  constructor(size: number = 64 * 1024) { // 64KB default
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
    this.offset = 0;
  }

  reset() {
    this.offset = 0;
  }

  private ensureCapacity(additional: number) {
    if (this.offset + additional > this.buffer.byteLength) {
      const newSize = Math.max(this.buffer.byteLength * 2, this.offset + additional);
      const newBuffer = new ArrayBuffer(newSize);
      const newView = new DataView(newBuffer);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.view = newView;
    }
  }

  writeUint8(val: number) { 
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, val); 
    this.offset += 1; 
  }
  
  writeUint16(val: number) { 
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, val, true); 
    this.offset += 2; 
  }
  
  writeUint32(val: number) { 
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, val, true); 
    this.offset += 4; 
  }
  
  writeInt32(val: number) { 
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, val, true); 
    this.offset += 4; 
  }
  
  writeFloat32(val: number) { 
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, val, true); 
    this.offset += 4; 
  }
  
  writeString(str: string) {
    const bytes = new TextEncoder().encode(str);
    this.writeUint16(bytes.length);
    this.ensureCapacity(bytes.length);
    new Uint8Array(this.buffer).set(bytes, this.offset);
    this.offset += bytes.length;
  }
  
  getBuffer() {
    // Use subarray to avoid slice() which creates a new ArrayBuffer
    return new Uint8Array(this.buffer, 0, this.offset);
  }
}

export class BinaryReader {
  view: DataView;
  offset: number;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  readUint8() { const val = this.view.getUint8(this.offset); this.offset += 1; return val; }
  readUint16() { const val = this.view.getUint16(this.offset, true); this.offset += 2; return val; }
  readUint32() { const val = this.view.getUint32(this.offset, true); this.offset += 4; return val; }
  readInt32() { const val = this.view.getInt32(this.offset, true); this.offset += 4; return val; }
  readFloat32() { const val = this.view.getFloat32(this.offset, true); this.offset += 4; return val; }
  readString() {
    const len = this.readUint16();
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
    this.offset += len;
    return new TextDecoder().decode(bytes);
  }
}
