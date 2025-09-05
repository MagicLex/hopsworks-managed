import { Html, Head, Main, NextScript } from 'next/document';
import Script from 'next/script';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link href="https://cdn.prod.website-files.com/5f6353590bb01cacbcecfbac/5fae450f4c337b814a73a7f7_favicon-png.png" rel="shortcut icon" type="image/x-icon" />
        <link href="https://cdn.prod.website-files.com/5f6353590bb01cacbcecfbac/5fae450f4c337b814a73a7f7_favicon-png.png" rel="apple-touch-icon" />
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#1eb182" />
        
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-2K8721P7HQ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-2K8721P7HQ');
          `}
        </Script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}