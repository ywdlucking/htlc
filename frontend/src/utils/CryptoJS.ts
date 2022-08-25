import CryptoJS from "crypto-js";
 
export interface CrypotoType {
    encryptCBC: any
    decryptCBC: any
    sha256: any
    tobytes: any
}
 
export default class Crypoto implements CrypotoType {
    private EK = "waiting setting";
    private keyHex = this.getHetKey()
 
    private getHetKey() {
        return CryptoJS.enc.Utf8.parse(this.EK);
    }

    private stringToBytes(str: string) {
      var bytes = new Array();
      var len, c;
      len = str.length;
      for (var i = 0; i < len; i++) {
          c = str.charCodeAt(i);
          if (c >= 0x010000 && c <= 0x10FFFF) {
              bytes.push(((c >> 18) & 0x07) | 0xF0);
              bytes.push(((c >> 12) & 0x3F) | 0x80);
              bytes.push(((c >> 6) & 0x3F) | 0x80);
              bytes.push((c & 0x3F) | 0x80);
          } else if (c >= 0x000800 && c <= 0x00FFFF) {
              bytes.push(((c >> 12) & 0x0F) | 0xE0);
              bytes.push(((c >> 6) & 0x3F) | 0x80);
              bytes.push((c & 0x3F) | 0x80);
          } else if (c >= 0x000080 && c <= 0x0007FF) {
              bytes.push(((c >> 6) & 0x1F) | 0xC0);
              bytes.push((c & 0x3F) | 0x80);
          } else {
              bytes.push(c & 0xFF);
          }
      }
      return bytes;
    }
 
    /** CBC encrypt */
    encryptCBC(word: string) {
        if (!word) {
            return word;
        }
        const srcs = CryptoJS.enc.Utf8.parse(word);
        const encrypted = CryptoJS.AES.encrypt(srcs, this.keyHex, {
            iv: this.keyHex,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.ZeroPadding
        });
        return encrypted.toString(); 
    }
 
    /** CBC decrypt */
    decryptCBC(word: string) {
        if (!word) {
            return word;
        }
        const encryptedHexStr = CryptoJS.enc.Hex.parse(word);
        const srcs = CryptoJS.enc.Base64.stringify(encryptedHexStr);
        const decrypt = CryptoJS.AES.decrypt(srcs, this.keyHex, {
            iv: this.keyHex,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.ZeroPadding
        });
        const decryptedStr = decrypt.toString(CryptoJS.enc.Utf8);
        return decryptedStr.toString();
    }

    sha256(word: string) :string{
      if (!word) {
        return word;
      }
      const encryptedHexStr = CryptoJS.enc.Hex.parse(word);
      const srcs = CryptoJS.enc.Base64.stringify(encryptedHexStr);
      
      return CryptoJS.SHA256(word).toString();
    }

    tobytes(word: string) :any[] {
      return this.stringToBytes(word);
    }
  
}