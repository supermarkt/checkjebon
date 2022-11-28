# Checkjebon.nl

Comparing food prices across multiple supermarkets is made a lot simpler using Checkjebon.nl. Simply scan your receipt, or enter your shopping list manually and you can instantly compare how much you would spend at each supermarket on the exact same products. You can query for generic products like "milk" or be more exact and specify the brand and amount.

<img src="/images/screenshot1.png" width="300" title="Shopping list editor">

This will bring up the amount due per supermarket for the shopping list.

<img src="/images/screenshot2.png" width="300" title="Prices per supermarket">

After setting up your shopping list and selecting your preferred supermarket, simply check off items as you collect them from the store.

<img src="/images/screenshot3.png" width="300" title="Shopping list">

You can share your current shopping list with family members or friends at any time, or use the sharing functionality to use the shopping list created on your desktop or tablet to your phone as you go out to get groceries.

The project is freely available for use on https://www.checkjebon.nl/

# Supported supermarkets

Checkjebon.nl is aimed at the Dutch market, and currently aims to provide accurate and recent prices for:

* [AH](https://www.ah.nl/)
* [ALDI](https://www.aldi.nl/) - Note; limited assortment due to not all products being available online.
* [Coop](https://www.coop.nl/)
* [DekaMarkt](https://www.dekamarkt.nl/) - Note; limited assortment due to not all products being available online.
* [Dirk](https://www.dirk.nl/)
* [Hoogvliet](https://www.hoogvliet.com/)
* [Jan Linders](https://www.janlinders.nl/)
* [Jumbo](https://www.jumbo.com/)
* [Plus](https://www.plus.nl/)
* [SPAR](https://www.spar.nl/)
* [Vomar](https://www.vomar.nl/)

Some supermarkets do not provide prices for their products online or are not yet indexed on a daily basis, and therefor are currently not included in the data set:

* [Boni](https://bonisupermarkt.nl/) - No online assortment.
* [Boon's Markt (MCD)](https://www.boonsmarkt.nl/) - No online assortment.
* [Butlon](https://butlon.com/) - Not yet indexed.
* [Crisp](https://www.crisp.nl/) - No online assortment without an account.
* [Dagwinkel](https://www.lekkermakkelijk.nl/) - Not yet indexed.
* [EkoPlaza](https://www.ekoplaza.nl/) - Not yet indexed.
* [Flink](https://www.goflink.com/) -  Not yet indexed.
* [GORILLAS](https://gorillas.io/nl) - No online assortment without an account.
* [Marqt](https://www.marqt.nl/) - No online assortment.
* [LIDL](https://www.lidl.nl/) - No online assortment.
* [Nettorama](https://www.nettorama.nl/) - No online assortment.
* [Odin](https://www.odin.nl/) -  Not yet indexed.
* [Picnic](http://picnic.nl/) - No online assortment without an account.
* [Sligro](https://www.sligro.nl/) - No online assortment without an account.

# Product selection algorithm

For any product added to the shopping list, Checkjebon.nl tries to take a best guess at what you actually meant. Sometimes this may result in not seeing what you expect, simply because other products come up cheaper. In general, first an exact match by name is attempted. If there was no exact match, a fuzzy search will be applied, compiling a list of all products that contain the words from the shopping list item. The fuzzy search finds products based on if they contain all the letters from your shopping list item in the same order as they are given, but not necessarily right next to each other. For example, "milk" will find "skiM mILK" as well as "whole MILK". When an amount in liter or kilogram is given, all products below the given amount are filtered out unless this returns zero results, in which case the filter is undone. Finally, products are first ordered by the string length of the fuzzy search (so "whole MILK"=>4 goes before "skiM mILK"=>6) in an attempt to find the closed possible match, those results are then ordered by price, and finally the top item from that list is returned. 

The algorithm works better when supplying exactly what you are looking for. Note that generic names like "milk" are not well suited for this even though in in day to day live that would be enough to write down since you will make the choice between "skim milk" or "whole milk" once you get to the cooling compartment. The same goes for products like "butter" ("salted butter", "whipped butter", "cream butter", etc).

When no prices are found for a specific product for any of the given supermarkets, a price estimate is used based on the most expensive price for that product among other supermarkets.

# Receipt scanning

When scanning receipts, [Tesseract.js](https://github.com/naptha/tesseract.js/) is used in order to detect text. After that, some processing is done to align the recognized text with true product names. Adjust any errors where necessary.

# Privacy

When entering your shopping list, you data never leaves your computer. All processing is done in the browser. Upon opening Checkjebon.nl, all available prices will be downloaded. You will see that reloading the page will not empty your shopping list; this is stored in your browser using the [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

# Open data

Product [price data](https://github.com/supermarkt/checkjebon/blob/main/data/supermarkets.json?raw=true) is updated frequently and may be reused in other projects.
