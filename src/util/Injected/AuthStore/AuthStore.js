'use strict';

exports.ExposeAuthStore = () => {
    window.AuthStore = {};
    window.AuthStore.AppState = window.require('WAWebSocketModel').Socket;
    window.AuthStore.Cmd = window.require('WAWebCmd').Cmd;
    window.AuthStore.Conn = window.require('WAWebConnModel').Conn;
    window.AuthStore.OfflineMessageHandler = window.require(
        'WAWebOfflineHandler',
    ).OfflineMessageHandler;
    window.AuthStore.PairingCodeLinkUtils = window.require(
        'WAWebAltDeviceLinkingApi',
    );
    window.AuthStore.Base64Tools = window.require('WABase64');
    window.AuthStore.RegistrationUtils = {
        ...window.require('WAWebCompanionRegClientUtils'),
        ...window.require('WAWebAdvSignatureApi'),
        ...window.require('WAWebUserPrefsInfoStore'),
        ...window.require('WAWebSignalStoreApi'),
    };
};
