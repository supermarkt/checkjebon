# Checkjebon.nl

Comparing food prices across multiple supermarkets is made a lot simpler using Checkjebon.nl. Simply scan your receipt, or enter your shopping list manually and you can instantly compare how much you would spend at each supermarket on the exact same products. You can query for generic products like "milk" or be more exact and specify the brand and amount.

The project is available for use on https://www.checkjebon.nl/

# Supported supermarkets

Checkjebon.nl is aimed at the Dutch market, and currently provides accurate prices for:

* [AH](https://www.ah.nl/)
* [ALDI](https://www.aldi.nl/) - Note; limited assortment due to not all products being available online.
* [Coop](https://www.coop.nl/)
* [DekaMarkt](https://www.dekamarkt.nl/) - Note; limited assortment due to not all products being available online.
* [Dirk](https://www.dirk.nl/)
* [Jumbo](https://www.jumbo.com/)
* [Plus](https://www.plus.nl/)
* [SPAR](https://www.spar.nl/)

When no prices are found for a specific product for any of the given supermarkets, an price estimate is used based on the most expensive price for that product among other supermarkets.

# Receipt scanning

When scanning receipts, [Tesseract.js](https://github.com/naptha/tesseract.js/) is used in order to detect text. After that, some processing is done to align the recognized text with true product names. Adjust any errors where necessary.

# Privacy

When entering your shopping list, you data never leaves your computer. All processing is done in the browser. Upon opening Checkjebon.nl, all available prices will be downloaded. You will see that reloading the page will not empty your shopping list; this is stored in your browser using the [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

# Open source

Product price data is updated frequently and may be reused.
