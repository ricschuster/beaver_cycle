package com.beavercycle.hostserver;

import android.content.Context;
import android.net.wifi.WifiManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

/**
 * Lets the host tablet listen for guests (docs/design/42_multiplayer.md, #662). A WebView cannot listen on a socket, so this
 * runs a WebSocket server and hands every text message to the page as a "message" event, with the id of the guest that sent it.
 */
@CapacitorPlugin(name = "HostServer")
public class HostServerPlugin extends Plugin {
    private WebSocketServer server;
    private final Map<String, WebSocket> guests = new ConcurrentHashMap<>();
    private int nextId = 1;

    @PluginMethod
    public void start(PluginCall call) {
        stopServer();
        int port = call.getInt("port", 8765);
        try {
            server = new WebSocketServer(new InetSocketAddress(port)) {
                @Override
                public void onOpen(WebSocket ws, ClientHandshake hs) {
                    String id = "g" + (nextId++);
                    ws.setAttachment(id);
                    guests.put(id, ws);
                    JSObject o = new JSObject();
                    o.put("id", id);
                    notifyListeners("open", o);
                }

                @Override
                public void onClose(WebSocket ws, int code, String reason, boolean remote) {
                    String id = ws.getAttachment();
                    if (id == null) return;
                    guests.remove(id);
                    JSObject o = new JSObject();
                    o.put("id", id);
                    notifyListeners("close", o);
                }

                @Override
                public void onMessage(WebSocket ws, String text) {
                    JSObject o = new JSObject();
                    o.put("id", (String) ws.getAttachment());
                    o.put("text", text);
                    notifyListeners("message", o);
                }

                @Override
                public void onError(WebSocket ws, Exception e) {
                    JSObject o = new JSObject();
                    o.put("error", String.valueOf(e));
                    notifyListeners("error", o);
                }

                @Override
                public void onStart() {
                    setConnectionLostTimeout(10);
                }
            };
            server.setReuseAddr(true);
            server.setTcpNoDelay(true);
            server.start();
            JSObject r = new JSObject();
            r.put("ip", wifiIp());
            r.put("port", port);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e));
        }
    }

    /** Sends text to one guest ("to"), or to all of them when "to" is missing. */
    @PluginMethod
    public void send(PluginCall call) {
        String text = call.getString("text", "");
        String to = call.getString("to");
        if (to != null) {
            WebSocket ws = guests.get(to);
            if (ws != null && ws.isOpen()) ws.send(text);
        } else {
            for (WebSocket ws : guests.values()) if (ws.isOpen()) ws.send(text);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopServer();
        call.resolve();
    }

    @PluginMethod
    public void getIp(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ip", wifiIp());
        call.resolve(r);
    }

    private void stopServer() {
        if (server == null) return;
        try {
            server.stop(200);
        } catch (Exception ignored) {
        }
        server = null;
        guests.clear();
    }

    @Override
    protected void handleOnDestroy() {
        stopServer();
    }

    /** The tablet's address on the WLAN: the first IPv4 address of wlan0, else any non-loopback one. */
    private String wifiIp() {
        try {
            String any = "";
            for (NetworkInterface i : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!i.isUp() || i.isLoopback()) continue;
                for (java.net.InetAddress a : Collections.list(i.getInetAddresses())) {
                    if (a instanceof java.net.Inet4Address) {
                        if (i.getName().startsWith("wlan")) return a.getHostAddress();
                        any = a.getHostAddress();
                    }
                }
            }
            return any;
        } catch (Exception e) {
            return "";
        }
    }
}
