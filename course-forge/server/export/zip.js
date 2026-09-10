import { deflateRawSync } from 'node:zlib'

/**
 * A minimal ZIP writer.
 *
 * SCORM packages are ordinary zip archives, and this is the only thing in the
 * project that needs one — small enough to write directly rather than take a
 * dependency for. Supports stored and deflated entries, which is all the
 * format requires of a reader.
 */

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const VERSION_NEEDED = 20
const DEFLATED = 8
const STORED = 0
/** Bit 11 tells the reader filenames are UTF-8, not the legacy code page. */
const UTF8_FLAG = 0x0800

export function createZip(entries, options = {}) {
  const date = options.date ?? new Date()
  const { time: dosTime, date: dosDate } = toDosDateTime(date)

  const chunks = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8')
    const crc = crc32(content)

    const deflated = content.length > 0 ? deflateRawSync(content) : Buffer.alloc(0)
    // Deflate can grow already-compressed or tiny payloads. Store those
    // instead, so an entry is never larger in the archive than out of it.
    const useDeflate = deflated.length < content.length
    const method = useDeflate ? DEFLATED : STORED
    const payload = useDeflate ? deflated : content

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_HEADER, 0)
    local.writeUInt16LE(VERSION_NEEDED, 4)
    local.writeUInt16LE(UTF8_FLAG, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(dosTime, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    chunks.push(local, name, payload)

    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(CENTRAL_HEADER, 0)
    directory.writeUInt16LE(VERSION_NEEDED, 4)
    directory.writeUInt16LE(VERSION_NEEDED, 6)
    directory.writeUInt16LE(UTF8_FLAG, 8)
    directory.writeUInt16LE(method, 10)
    directory.writeUInt16LE(dosTime, 12)
    directory.writeUInt16LE(dosDate, 14)
    directory.writeUInt32LE(crc, 16)
    directory.writeUInt32LE(payload.length, 20)
    directory.writeUInt32LE(content.length, 24)
    directory.writeUInt16LE(name.length, 28)
    directory.writeUInt16LE(0, 30)
    directory.writeUInt16LE(0, 32)
    directory.writeUInt16LE(0, 34)
    directory.writeUInt16LE(0, 36)
    directory.writeUInt32LE(0o644 << 16, 38)
    directory.writeUInt32LE(offset, 42)

    central.push(directory, name)
    offset += local.length + name.length + payload.length
  }

  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...chunks, centralBuffer, end])
}

let crcTable = null

function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Int32Array(256)
    for (let i = 0; i < 256; i += 1) {
      let value = i
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
      }
      crcTable[i] = value
    }
  }
  let crc = -1
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

function toDosDateTime(date) {
  // The DOS timestamp epoch is 1980 and seconds are stored in 2-second units.
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}
