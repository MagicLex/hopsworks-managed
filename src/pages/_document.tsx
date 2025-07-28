import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link href="https://cdn.prod.website-files.com/5f6353590bb01cacbcecfbac/5fae450f4c337b814a73a7f7_favicon-png.png" rel="shortcut icon" type="image/x-icon" />
        <link href="https://cdn.prod.website-files.com/5f6353590bb01cacbcecfbac/5fae450f4c337b814a73a7f7_favicon-png.png" rel="apple-touch-icon" />
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#1eb182" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}