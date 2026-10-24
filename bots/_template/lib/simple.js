/**
 * Utilidades mínimas de Baileys para la plantilla.
 *
 * Esta versión es autocontenida: solo depende de Baileys, file-type y utilidades
 * de Node, por lo que la plantilla arranca sin módulos hermanos inexistentes.
 * Expone lo que usa main.js: protoType() y serialize(); smsg() y logic() se
 * mantienen porque serialize() los utiliza. El wrapper completo makeWASocket
 * (con converter/store/viewOnce/baileys-dual…) vive en universal-bot: cópialo
 * desde ahí si tu bot lo necesita.
 */
import util, { format } from 'node:util'
import { fileTypeFromBuffer } from 'file-type'

const {
  proto,
  areJidsSameUser,
  jidDecode,
  extractMessageContent,
} = await import('@whiskeysockets/baileys')

export function smsg(conn, m, tienePadre) {
  if (!m) return m;
  const M = proto.WebMessageInfo;
  try {
    m = M.create(m);
    m.conn = conn;
    let claveMensajeProtocolo;
    if (m.message) {
      if (m.mtype == "protocolMessage" && m.msg?.key) {
        claveMensajeProtocolo = m.msg.key;
        if (claveMensajeProtocolo.remoteJid === "status@broadcast") {
          claveMensajeProtocolo.remoteJid = m.chat || "";
        }
        if (
          !claveMensajeProtocolo.participant ||
          claveMensajeProtocolo.participant === "status_me"
        ) {
          claveMensajeProtocolo.participant =
            typeof m.sender === "string" ? m.sender : "";
        }
        const participanteDecodificado =
          conn?.decodeJid?.(claveMensajeProtocolo.participant) || "";
        claveMensajeProtocolo.fromMe =
          participanteDecodificado === (conn?.user?.id || "");
        if (
          !claveMensajeProtocolo.fromMe &&
          claveMensajeProtocolo.remoteJid === (conn?.user?.id || "")
        ) {
          claveMensajeProtocolo.remoteJid =
            typeof m.sender === "string" ? m.sender : "";
        }
      }
      if (m.quoted && !m.quoted.mediaMessage) {
        delete m.quoted.download;
      }
    }
    if (!m.mediaMessage) {
      delete m.download;
    }
    if (claveMensajeProtocolo && m.mtype == "protocolMessage") {
      try {
        conn.ev.emit("message.delete", claveMensajeProtocolo);
      } catch (e) {
        console.error("Error al emitir message.delete:", e);
      }
    }
    return m;
  } catch (e) {
    console.error("Error en smsg:", e);
    return m;
  }
}


export function serialize() {
  const TiposMedia = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage",];
  const terminaConSeguro = (str, suffix) =>
    typeof str === "string" && str.endsWith(suffix);
  const decodificarJidSeguro = (jid, conn) => {
    try {
      if (!jid || typeof jid !== "string") return "";
      return conn?.decodeJid?.(jid) || jid;
    } catch (e) {
      console.error("Error en safeDecodeJid:", e);
      return "";
    }
  };
  const dividirSeguro = (str, separator) =>
    typeof str === "string" ? str.split(separator) : [];
  return Object.defineProperties(proto.WebMessageInfo.prototype, {
    conn: {
      value: undefined,
      enumerable: false,
      writable: true,
    },
    id: {
      get() {
        try {
          return this.key?.id || "";
        } catch (e) {
          console.error("Error en id getter:", e);
          return "";
        }
      },
      enumerable: true,
    },
    isBaileys: {
      get() {
        try {
          const idUsuario = this.conn?.user?.id || "";
          const sender = this.sender || "";
          return (
            ((this?.fromMe || areJidsSameUser(idUsuario, sender)) &&
              this.id?.startsWith?.("3EB0") &&
              [20, 22, 12].includes(this.id?.length)) ||
            false
          );
        } catch (e) {
          console.error("Error en isBaileys getter:", e);
          return false;
        }
      },
      enumerable: true,
    },
    chat: {
      get() {
        try {
          const senderKeyDistributionMessage =
            this.message?.senderKeyDistributionMessage?.groupId;
          const jidCrudo =
            this.key?.remoteJid ||
            (senderKeyDistributionMessage &&
              senderKeyDistributionMessage !== "status@broadcast") ||
            "";
          return decodificarJidSeguro(jidCrudo, this.conn);
        } catch (e) {
          console.error("Error en chat getter:", e);
          return "";
        }
      },
      enumerable: true,
    },
    isGroup: {
      get() {
        try {
          return terminaConSeguro(this.chat, "@g.us");
        } catch (e) {
          console.error("Error en isGroup getter:", e);
          return false;
        }
      },
      enumerable: true,
    },
    isNewsletter: {
      get() {
        try {
          return terminaConSeguro(this.chat, "@newsletter");
        } catch (e) {
          console.error("Error en isNewsletter getter:", e);
          return false;
        }
      },
      enumerable: true,
    },
    sender: {
      get() {
        try {
          // Baileys 7: si el primary es @lid, el PN suele venir en participantAlt / remoteJidAlt
          const alt = this.key?.participantAlt || this.key?.remoteJidAlt
          if (alt && (String(alt).endsWith('@s.whatsapp.net') || String(alt).endsWith('@c.us'))) {
            return this.conn?.decodeJid(alt) || alt
          }

          const primary = this.key?.fromMe && this.conn?.user.id
            || this.participant
            || this.key?.participant
            || this.chat
            || ''
          return this.conn?.decodeJid(primary) || primary
        } catch (e) {
          console.error('Error en sender getter:', e)
          return ''
        }
      },
      enumerable: true,
    },
    /*sender: {
      get() {
        if (this.messageStubType) {
          if (this.messageStubType === 32) { 
            return this.messageStubParameters?.[0] || this.key?.remoteJid || '';
          } else if (this.messageStubType === 20) { 
            return this.key?.participant || this.key?.remoteJid || '';
          } else { 
            return this.key?.participant || this.key?.remoteJid || '';
          }
        }
        const parse1 = (this.participant || this.key.participant || this.chat || '').decodeJid();
        if (parse1 && parse1.includes('@lid')) {
          return parse1.resolveLidToRealJid(this.chat, mconn.conn);
        }
        return this.conn?.decodeJid(this.key?.fromMe && this.conn?.user.id || this.participant || this.key.participant || this.chat || '');
      },
      enumerable: true,
    },*/
    fromMe: {
      get() {
        try {
          const idUsuario = this.conn?.user?.id || "";
          const sender = this.sender || "";
          return this.key?.fromMe || areJidsSameUser(idUsuario, sender) || false;
        } catch (e) {
          console.error("Error en fromMe getter:", e);
          return false;
        }
      },
      enumerable: true,
    },
    mtype: {
      get() {
        try {
          if (!this.message) return "";
          const type = Object.keys(this.message);

          if (
            !["senderKeyDistributionMessage", "messageContextInfo"].includes(
              type[0],
            )
          ) {
            return type[0];
          }

          if (type.length >= 3 && type[1] !== "messageContextInfo") {
            return type[1];
          }

          return type[type.length - 1];
        } catch (e) {
          console.error("Error en mtype getter:", e);
          return "";
        }
      },
      enumerable: true,
    },
    msg: {
      get() {
        try {
          if (!this.message) return null;
          return this.message[this.mtype] || null;
        } catch (e) {
          console.error("Error en msg getter:", e);
          return null;
        }
      },
      enumerable: true,
    },
    mediaMessage: {
      get() {
        try {
          if (!this.message) return null;

          const Message =
            (this.msg?.url || this.msg?.directPath
              ? { ...this.message }
              : extractMessageContent(this.message)) || null;
          if (!Message) return null;

          const tipoMsg = Object.keys(Message)[0];
          return TiposMedia.includes(tipoMsg) ? Message : null;
        } catch (e) {
          console.error("Error en mediaMessage getter:", e);
          return null;
        }
      },
      enumerable: true,
    },
    mediaType: {
      get() {
        try {
          const message = this.mediaMessage;
          if (!message) return null;
          return Object.keys(message)[0];
        } catch (e) {
          console.error("Error en mediaType getter:", e);
          return null;
        }
      },
      enumerable: true,
    },
    quoted: {
      get() {
        try {
          const self = this;
          const msg = self.msg;
          const contextInfo = msg?.contextInfo;
          const quoted = contextInfo?.quotedMessage;

          if (!msg || !contextInfo || !quoted) return null;

          const type = Object.keys(quoted)[0];
          const q = quoted[type];
          const text = typeof q === "string" ? q : q?.text || "";

          return Object.defineProperties(
            JSON.parse(
              JSON.stringify(typeof q === "string" ? { text: q } : q || {}),
            ),
            {
              mtype: {
                get() {
                  return type;
                },
                enumerable: true,
              },
              mediaMessage: {
                get() {
                  const Message =
                    (q?.url || q?.directPath
                      ? { ...quoted }
                      : extractMessageContent(quoted)) || null;
                  if (!Message) return null;
                  const tipoMsg = Object.keys(Message)[0];
                  return TiposMedia.includes(tipoMsg) ? Message : null;
                },
                enumerable: true,
              },
              mediaType: {
                get() {
                  const message = this.mediaMessage;
                  if (!message) return null;
                  return Object.keys(message)[0];
                },
                enumerable: true,
              },
              id: {
                get() {
                  return contextInfo.stanzaId || "";
                },
                enumerable: true,
              },
              chat: {
                get() {
                  return contextInfo.remoteJid || self.chat || "";
                },
                enumerable: true,
              },
              isBaileys: {
                get() {
                  const idUsuario = self.conn?.user?.id || "";
                  const sender = this.sender || "";
                  return (
                    ((this?.fromMe || areJidsSameUser(idUsuario, sender)) &&
                      this.id?.startsWith?.("3EB0") &&
                      [20, 22, 12].includes(this.id?.length)) ||
                    false
                  );
                },
                enumerable: true,
              },
              sender: {
                get() {
                  try {
                    const participanteCrudo = contextInfo.participant;
                    if (!participanteCrudo) {
                      const isFromMe =
                        this.key?.fromMe ||
                        areJidsSameUser(this.chat, self.conn?.user?.id || "");
                      return isFromMe
                        ? decodificarJidSeguro(self.conn?.user?.id, self.conn)
                        : this.chat;
                    }
                    
                    return decodificarJidSeguro(participanteCrudo, self.conn) || participanteCrudo;
                  } catch (e) {
                    console.error("Error en quoted sender getter:", e);
                    return contextInfo.participant || "";
                  }
                },
                enumerable: true,
              },
              fromMe: {
                get() {
                  const sender = this.sender || "";
                  const userJid = self.conn?.user?.jid || "";
                  return areJidsSameUser(sender, userJid);
                },
                enumerable: true,
              },
              text: {
                get() {
                  return (
                    text ||
                    this.caption ||
                    this.contentText ||
                    this.selectedDisplayText ||
                    ""
                  );
                },
                enumerable: true,
              },
              mentionedJid: {
                get() {
                  const mentioned =
                    q?.contextInfo?.mentionedJid ||
                    self.getQuotedObj()?.mentionedJid ||
                    [];
                  return mentioned
                    .map((user) => {
                      if (user && typeof user === "object") {
                        user = user.lid || user.jid || user.id || "";
                      }
                      if (typeof user === "string" && user.includes("@lid")) {
                        const resolved = user.resolveLidToRealJid(
                          user,
                          self.conn,
                        );
                        return typeof resolved === "string" ? resolved : user;
                      }
                      return user;
                    })
                    .filter((jid) => jid && typeof jid === "string");
                },
                enumerable: true,
              },
              name: {
                get() {
                  const sender = this.sender;
                  return sender ? self.conn?.getName?.(sender) : null;
                },
                enumerable: true,
              },
              vM: {
                get() {
                  return proto.WebMessageInfo.create({
                    key: {
                      fromMe: this.fromMe,
                      remoteJid: this.chat,
                      id: this.id,
                    },
                    message: quoted,
                    ...(self.isGroup ? { participant: this.sender } : {}),
                  });
                },
                enumerable: true,
              },
              fakeObj: {
                get() {
                  return this.vM;
                },
                enumerable: true,
              },
              download: {
                value(guardarEnArchivo = false) {
                  const tipoMsg = this.mediaType;
                  return self.conn?.downloadM?.(
                    this.mediaMessage?.[tipoMsg],
                    tipoMsg?.replace(/message/i, ""),
                    guardarEnArchivo,
                  );
                },
                enumerable: true,
                configurable: true,
              },
              reply: {
                value(text, chatId, options) {
                  return self.conn?.reply?.(
                    chatId ? chatId : this.chat,
                    text,
                    this.vM,
                    options,
                  );
                },
                enumerable: true,
              },
              copy: {
                value() {
                  const M = proto.WebMessageInfo;
                  return smsg(self.conn, M.create(M.toObject(this.vM)));
                },
                enumerable: true,
              },
              forward: {
                value(jid, force = false, options) {
                  return self.conn?.sendMessage?.(
                    jid,
                    {
                      forward: this.vM,
                      force,
                      ...options,
                    },
                    { ...options },
                  );
                },
                enumerable: true,
              },
              copyNForward: {
                value(jid, forzarReenvio = false, options) {
                  return self.conn?.copyNForward?.(
                    jid,
                    this.vM,
                    forzarReenvio,
                    options,
                  );
                },
                enumerable: true,
              },
              cMod: {
                value(jid, text = "", sender = this.sender, options = {}) {
                  return self.conn?.cMod?.(jid, this.vM, text, sender, options);
                },
                enumerable: true,
              },
              delete: {
                value() {
                  return self.conn?.sendMessage?.(this.chat, {
                    delete: this.vM.key,
                  });
                },
                enumerable: true,
              },
            },
          );
        } catch (e) {
          console.error("Error en quoted getter:", e);
          return null;
        }
      },
      enumerable: true,
    },
    _text: {
      value: null,
      writable: true,
      enumerable: true,
    },
    text: {
      get() {
        try {
          if (typeof this._text === "string" && this._text) return this._text;

          const tipoMsg = this.mtype;
          const msg = this.msg;

          if (tipoMsg === "listResponseMessage") {
            const idFila = msg?.singleSelectReply?.selectedRowId;
            if (idFila) return idFila;
          }
          if (tipoMsg === "buttonsResponseMessage") {
            const idBoton = msg?.selectedButtonId;
            if (idBoton) return idBoton;
          }
          if (tipoMsg === "templateButtonReplyMessage") {
            const idPlantilla = msg?.selectedId;
            if (idPlantilla) return idPlantilla;
          }
          if (tipoMsg === "interactiveResponseMessage") {
            const paramsJson = msg?.nativeFlowResponseMessage?.paramsJson;
            if (paramsJson) {
              try {
                const parsed = JSON.parse(paramsJson);
                if (parsed?.id) return String(parsed.id);
              } catch {}
            }
          }

          const text =
            (typeof msg === "string" ? msg : msg?.text) ||
            msg?.caption ||
            msg?.contentText ||
            "";
          return (
            (typeof text === "string"
              ? text
              : text?.selectedDisplayText ||
                text?.hydratedTemplate?.hydratedContentText ||
                text) || ""
          );
        } catch (e) {
          console.error("Error en text getter:", e);
          return "";
        }
      },
      set(str) {
        this._text = str;
      },
      enumerable: true,
    },
    mentionedJid: {
      get() {
        try {
          const mentioned = this.msg?.contextInfo?.mentionedJid || [];
          return mentioned
            .map((user) => {
              if (user && typeof user === "object") {
                user = user.lid || user.jid || user.id || "";
              }
              if (typeof user === "string" && user.includes("@lid")) {
                const resolved = user.resolveLidToRealJid(user, this.conn);
                return typeof resolved === "string" ? resolved : user;
              }
              return user;
            })
            .filter((jid) => jid && typeof jid === "string");
        } catch (e) {
          console.error("Error en mentionedJid getter:", e);
          return [];
        }
      },
      enumerable: true,
    },
    name: {
      get() {
        try {
          if (!esNulo(this.pushName) && this.pushName) return this.pushName;
          const sender = this.sender;
          return sender ? this.conn?.getName?.(sender) : "";
        } catch (e) {
          console.error("Error en name getter:", e);
          return "";
        }
      },
      enumerable: true,
    },
    download: {
      value(guardarEnArchivo = false) {
        try {
          const tipoMsg = this.mediaType;
          return this.conn?.downloadM?.(
            this.mediaMessage?.[tipoMsg],
            tipoMsg?.replace(/message/i, ""),
            guardarEnArchivo,
          );
        } catch (e) {
          console.error("Error en download:", e);
          return Promise.reject(e);
        }
      },
      enumerable: true,
      configurable: true,
    },
    reply: {
      value(text, chatId, options) {
        try {
          return this.conn?.reply?.(
            chatId ? chatId : this.chat,
            text,
            this,
            options,
          );
        } catch (e) {
          console.error("Error en reply:", e);
          return Promise.reject(e);
        }
      },
      enumerable: true,
    },
    copy: {
      value() {
        try {
          const M = proto.WebMessageInfo;
          return smsg(this.conn, M.fromObject(M.toObject(this)));
        } catch (e) {
          console.error("Error en copy:", e);
          return null;
        }
      },
      enumerable: true,
    },
    forward: {
      value(jid, force = false, options = {}) {
        try {
          return this.conn?.sendMessage?.(
            jid,
            {
              forward: this,
              force,
              ...options,
            },
            { ...options },
          );
        } catch (e) {
          console.error("Error en forward:", e);
          return Promise.reject(e);
        }
      },
      enumerable: true,
    },
    copyNForward: {
      value(jid, forzarReenvio = false, options = {}) {
        try {
          return this.conn?.copyNForward?.(jid, this, forzarReenvio, options);
        } catch (e) {
          console.error("Error en copyNForward:", e);
          return Promise.reject(e);
        }
      },
      enumerable: true,
    },
    cMod: {
      value(jid, text = "", sender = this.sender, options = {}) {
        try {
          return this.conn?.cMod?.(jid, this, text, sender, options);
        } catch (e) {
          console.error("Error en cMod:", e);
          return Promise.reject(e);
        }
      },
      enumerable: true,
    },
    getQuotedObj: {
      value() {
        try {
          if (!this.quoted?.id) return null;
          const q = proto.WebMessageInfo.create(
            this.conn?.loadMessage?.(this.quoted.id) || this.quoted.vM || {},
          );
          return smsg(this.conn, q);
        } catch (e) {
          console.error("Error en getQuotedObj:", e);
          return null;
        }
      },
      enumerable: true,
    },
    getQuotedMessage: {
      get() {
        return this.getQuotedObj;
      },
      enumerable: true,
    },
    delete: {
      value() {
        try {
          return this.conn?.sendMessage?.(this.chat, { delete: this.key });
        } catch (e) {
          console.error("Error en delete:", e);
          return Promise.reject(e);
        }
      },
      enumerable: true,
    },
  });
}

export function logic(valor, entradas, salidas) {
  if (entradas.length !== salidas.length)
    throw new Error("Input and Output must have same length");
  for (const i in entradas)
    if (util.isDeepStrictEqual(valor, entradas[i])) return salidas[i];
  return null;
}

export function protoType() {
  Buffer.prototype.toArrayBuffer = function toArrayBufferV2() {
    const bufferArray = new ArrayBuffer(this.length);
    const vista = new Uint8Array(bufferArray);
    for (let i = 0; i < this.length; ++i) {
      vista[i] = this[i];
    }
    return bufferArray;
  };
  /**
   * @return {ArrayBuffer}
   */
  Buffer.prototype.toArrayBufferV2 = function toArrayBuffer() {
    return this.buffer.slice(
      this.byteOffset,
      this.byteOffset + this.byteLength,
    );
  };
  /**
   * @return {Buffer}
   */
  ArrayBuffer.prototype.toBuffer = function toBuffer() {
    return Buffer.from(new Uint8Array(this));
  };
  // /**
  //  * @returns {String}
  //  */
  // Buffer.prototype.toUtilFormat = ArrayBuffer.prototype.toUtilFormat = Object.prototype.toUtilFormat = Array.prototype.toUtilFormat = function toUtilFormat() {
  //     return util.format(this)
  // }
  Uint8Array.prototype.getFileType =
    ArrayBuffer.prototype.getFileType =
    Buffer.prototype.getFileType =
      async function getFileType() {
        return await fileTypeFromBuffer(this);
      };
  /**
   * @returns {Boolean}
   */
  String.prototype.isNumber = Number.prototype.isNumber = esNumero;
  /**
   *
   * @return {String}
   */
  String.prototype.capitalize = function capitalize() {
    return this.charAt(0).toUpperCase() + this.slice(1, this.length);
  };
  /**
   * @return {String}
   */
  String.prototype.capitalizeV2 = function capitalizeV2() {
    const partes = this.split(" ");
    return partes.map((v) => v.capitalize()).join(" ");
  };

  
  String.prototype.resolveLidToRealJid = (function () {
    const cacheLid = new Map();
    return async function (
      groupChatId,
      conn,
      maxReintentos = 3,
      retardoReintento = 60000,
    ) {
      const jidEntrada = this.toString();
      if (!jidEntrada.endsWith("@lid") || !groupChatId?.endsWith("@g.us")) {
        return jidEntrada.includes("@") ? jidEntrada : `${jidEntrada}@s.whatsapp.net`;
      }
      if (cacheLid.has(jidEntrada)) {
        return cacheLid.get(jidEntrada);
      }
      const lidBuscado = jidEntrada.split("@")[0].split(":")[0];

      // 1) Baileys oficial: lidMapping.getPNForLID
      try {
        const pn = await conn?.signalRepository?.lidMapping?.getPNForLID?.(jidEntrada);
        if (pn && String(pn).includes("@s.whatsapp.net")) {
          const clean = conn.decodeJid?.(pn) || pn;
          cacheLid.set(jidEntrada, clean);
          return clean;
        }
      } catch {}

      let intentosLid = 0;
      while (intentosLid < maxReintentos) {
        try {
          const metadata = await conn?.groupMetadata(groupChatId);
          if (!metadata?.participants)
            throw new Error("No se obtuvieron participantes");
          for (const participant of metadata.participants) {
            try {
              const pid = conn?.decodeJid?.(participant.id) || participant.id;
              const pLid = participant.lid
                ? (String(participant.lid).includes("@") ? participant.lid : `${participant.lid}@lid`)
                : "";
              const pPhone = participant.phoneNumber
                ? (String(participant.phoneNumber).includes("@")
                  ? participant.phoneNumber
                  : `${String(participant.phoneNumber).replace(/\D/g, "")}@s.whatsapp.net`)
                : "";

              const lidMatch =
                (pid && pid.split("@")[0].split(":")[0] === lidBuscado) ||
                (pLid && pLid.split("@")[0].split(":")[0] === lidBuscado);

              if (lidMatch && pPhone) {
                const clean = conn.decodeJid?.(pPhone) || pPhone;
                try {
                  await conn?.signalRepository?.lidMapping?.storeLIDPNMappings?.([
                    { lid: jidEntrada, pn: clean },
                  ]);
                } catch {}
                cacheLid.set(jidEntrada, clean);
                return clean;
              }

              if (!participant?.jid) continue;
              const detallesContacto = await conn?.onWhatsApp(participant.jid);
              if (!detallesContacto?.[0]?.lid) continue;
              const lidPosible = detallesContacto[0].lid.split("@")[0];
              if (lidPosible === lidBuscado) {
                cacheLid.set(jidEntrada, participant.jid);
                return participant.jid;
              }
            } catch (e) {
              continue;
            }
          }
          cacheLid.set(jidEntrada, jidEntrada);
          return jidEntrada;
        } catch (e) {
          if (++intentosLid >= maxReintentos) {
            cacheLid.set(jidEntrada, jidEntrada);
            return jidEntrada;
          }
          await new Promise((resolve) => setTimeout(resolve, retardoReintento));
        }
      }
      return jidEntrada;
    };
  })();

  String.prototype.decodeJid = function decodeJid() {
    if (/:\d+@/gi.test(this)) {
      const decodificado = jidDecode(this) || {};
      return (
        (decodificado.user && decodificado.server && decodificado.user + "@" + decodificado.server) ||
        this
      ).trim();
    } else return this.trim();
  };
  /**
   * El número debe estar en milisegundos
   * @return {string}
   */
  Number.prototype.toTimeString = function toTimeString() {
  
    const segundos = Math.floor((this / 1000) % 60);
    const minutos = Math.floor((this / (60 * 1000)) % 60);
    const horas = Math.floor((this / (60 * 60 * 1000)) % 24);
    const dias = Math.floor(this / (24 * 60 * 60 * 1000));
    return (
      (dias ? `${dias} day(s) ` : "") +
      (horas ? `${horas} hour(s) ` : "") +
      (minutos ? `${minutos} minute(s) ` : "") +
      (segundos ? `${segundos} second(s)` : "")
    ).trim();
  };
  Number.prototype.getRandom =
    String.prototype.getRandom =
    Array.prototype.getRandom =
      obtenerAleatorio;
}

function esNumero() {
  const int = parseInt(this);
  return typeof int === "number" && !isNaN(int);
}

function obtenerAleatorio() {
  if (Array.isArray(this) || this instanceof String)
    return this[Math.floor(Math.random() * this.length)];
  return Math.floor(Math.random() * this);
}

/**
 * - (null || undefined) ?? 'idk'
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_operator
 */
function esNulo(args) {
  return !(args !== null && args !== undefined);
}
