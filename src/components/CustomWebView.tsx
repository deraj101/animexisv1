// @ts-nocheck
import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// ─── AD-BLOCKING SCRIPT (injected into native WebView only) ──────────────────
// Blocks ad network requests and popup windows without touching sandbox,
// so the video player itself keeps working.
const AD_BLOCK_SCRIPT = `
(function() {
  const AD_HOSTS = [
    'doubleclick.net','googlesyndication.com','googleadservices.com',
    'adservice.google.com','amazon-adsystem.com','ads.yahoo.com',
    'adsrvr.org','adnxs.com','rubiconproject.com','openx.net',
    'pubmatic.com','criteo.com','taboola.com','outbrain.com',
    'mgid.com','revcontent.com','popads.net','popcash.net',
    'propellerads.com','hilltopads.net','juicyads.com','exoclick.com',
    'trafficjunky.com','adsterra.com','clickadu.com','adcash.com',
  ];
  const isAd = (url) => {
    try { return AD_HOSTS.some(h => new URL(url).hostname.includes(h)); }
    catch { return false; }
  };
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (isAd(url)) return new Promise(() => {});
    return origFetch.apply(this, arguments);
  };
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isAd(url)) { this._blocked = true; return; }
    return origOpen.apply(this, arguments);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) return;
    return origSend.apply(this, arguments);
  };
  // Block popup windows
  window.open = function() { return null; };
  // Remove ad overlay elements periodically
  const AD_SELECTORS = [
    'ins.adsbygoogle',
    'div[id*="popup"]','div[class*="popup"]',
    'div[id*="overlay"]','div[class*="overlay"]',
    'div[id*="advert"]','div[class*="advert"]',
    'div[id*="banner"]','div[class*="banner"]',
    'iframe[src*="doubleclick"]','iframe[src*="googlesyndication"]',
    '#ad','#ads','.ad','.ads','.adsbygoogle',
  ].join(',');
  const removeAds = () => {
    try { document.querySelectorAll(AD_SELECTORS).forEach(el => el.remove()); }
    catch {}
  };
  removeAds();
  setInterval(removeAds, 1500);
})();
true;
`;

const WEB_PLAYER_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";

let WebViewComponent;

if (Platform.OS === 'web') {
  // Web: sandboxed iframe blocks popups/top-page redirects while keeping playback usable.
  WebViewComponent = function WebIframe({ source, style, onLoadStart, onLoadEnd, onError }) {
    const iframeRef = React.useRef(null);

    React.useEffect(() => {
      if (onLoadStart) onLoadStart();
      const iframe = iframeRef.current;
      if (iframe) {
        iframe.onload  = () => { if (onLoadEnd) onLoadEnd(); };
        iframe.onerror = (e) => { if (onError) onError({ nativeEvent: e }); };
      }
      // When an ad tries to steal focus (tab-under trick), snap it back
      const handleBlur = () => { setTimeout(() => window.focus(), 0); };
      window.addEventListener('blur', handleBlur);
      return () => window.removeEventListener('blur', handleBlur);
    }, []);

    return (
      <iframe
        ref={iframeRef}
        src={source.uri}
        style={{
          width:  style?.width  || '100%',
          height: style?.height || '100%',
          border: 'none',
          backgroundColor: '#080809',
          ...style,
        }}
        allow="autoplay; fullscreen; encrypted-media"
        sandbox={WEB_PLAYER_SANDBOX}
        referrerPolicy="no-referrer"
        allowFullScreen
      />
    );
  };
} else {
  // Native: use react-native-webview with injected ad-blocker
  const { WebView } = require('react-native-webview');
  WebViewComponent = function NativeAdBlockedWebView({ injectedJavaScript, ...props }) {
    return (
    <WebView
      {...props}
      injectedJavaScript={AD_BLOCK_SCRIPT + (injectedJavaScript || '')}
      onShouldStartLoadWithRequest={(req) => {
        const AD_HOSTS = [
          'doubleclick.net','googlesyndication.com','popads.net',
          'popcash.net','propellerads.com','exoclick.com','adsterra.com',
        ];
        try {
          const host = new URL(req.url).hostname;
          if (AD_HOSTS.some(h => host.includes(h))) return false;
        } catch {}
        return true;
      }}
    />
    );
  };
}

// ─── FALLBACK ─────────────────────────────────────────────────────────────────
const WebViewFallback = ({ url, onRetry }) => (
  <BlurView intensity={80} tint="dark" style={styles.fallbackContainer}>
    <View style={styles.fallbackContent}>
      <View style={styles.fallbackIconContainer}>
        <Ionicons name="alert-circle" size={48} color="#DC143C" />
      </View>
      <Text style={styles.fallbackText}>Failed to load video player</Text>
      <Text style={styles.fallbackUrl} numberOfLines={2}>{url}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.openBrowserButton}
        onPress={() => {
          if (Platform.OS === 'web') window.open(url, '_blank');
          else Linking.openURL(url);
        }}
      >
        <Text style={styles.openBrowserText}>Open in Browser</Text>
      </TouchableOpacity>
    </View>
  </BlurView>
);

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function CustomWebView(props) {
  const [hasError, setHasError] = React.useState(false);

  if (hasError) {
    return <WebViewFallback url={props.source?.uri} onRetry={() => setHasError(false)} />;
  }
  if (!WebViewComponent) {
    return <WebViewFallback url={props.source?.uri} />;
  }

  return (
    <WebViewComponent
      {...props}
      onError={(e) => {
        setHasError(true);
        if (props.onError) props.onError(e);
      }}
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContent: {
    padding: 20,
    alignItems: 'center',
    maxWidth: 300,
  },
  fallbackIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(220,20,60,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  fallbackText: {
    color: "#DC143C",
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackUrl: {
    color: '#9090a8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#DC143C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    marginBottom: 12,
    width: '100%',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  openBrowserButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  openBrowserText: {
    color: '#DC143C',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
