var app = new Vue(
{
	el: "#checkjebon",
	data:
	{
		prices: [],
		shoppinglist: "",
		products: [],
		supermarkets: [],
		selectSupermarket: null
	},
	methods:
	{
		loadPrices: function()
		{
			fetch("https://www.checkjebon.nl/data/supermarkets.json").then((response) =>
			{
				return response.json();
			}).then((prices) =>
			{
				this.prices = prices;
			});
		},
		example: function()
		{
			this.shoppinglist = "HALFV MELK\nKNOFLOOKSAUS\nSHOAMA\nMAALTIJDPITA\nKIPSCHNITZEL\nKIPFILET\nBANANEN\nVERSPAKKET TERIYAKI";
		},
		scan: function()
		{
			if (this.prices.length == 0)
			{
				setTimeout(function()
				{
					// Still loading prices, wait and retry
					app.scan();
				}, 100);
				return;
			}
			
			var fileSelector = document.getElementById("file-selector");
			
			fileSelector.addEventListener("change", (event) =>
			{
				var fileList = event.target.files;
				if (fileList.length > 0)
				{
					var fileReader = new FileReader();
					fileReader.addEventListener("load", (event) => 
					{
						var imageData = event.target.result;
						Tesseract.recognize(
							imageData,
							"nld",
							{
								logger: m => 
								{
									this.shoppinglist = m.status + ": " + (m.progress * 100).toFixed(0) + "%";
								}
							}
						).then(({ data: { text } }) => 
						{
							// Remove all non-text characters
							text = text.replace(/([^a-zA-Z\s])+/g, "");
							// Remove all words that are 3 or less characters
							text = text.replace(/\b([a-zA-Z]){0,3}\b/g, "");
							// Trim results
							text = text.split("\n").map(t => t.trim()).join("\n");
							// Remove empty lines
							text = text.trim().replace(/\n{2,}/g, "\n");
							// Use fuzzy search logic to find closest match to fix typos
							/*
							//var words = app.prices[2].d;
							var words = [... new Set(app.prices.map(p => p.d).flat())];
							//var words = [... new Set(app.prices.map(p => p.d).flat().map(p => p.n.split(" ")).flat())].filter(p => p.length > 4).map(p => {return {n: p}});
							text = text.split("\n").map((t, i) => 
							{
								this.shoppinglist = "matching: " + (i / text.split("\n").length * 100).toFixed(0) + "%";
								const options = {
									// isCaseSensitive: false,
									// includeScore: false,
									shouldSort: true,
									// includeMatches: false,
									// findAllMatches: false,
									// minMatchCharLength: 1,
									// location: 0,
									threshold: 0.4,
									// distance: 100,
									// useExtendedSearch: false,
									// ignoreLocation: false,
									// ignoreFieldNorm: false,
									// fieldNormWeight: 1,
									keys: [
										"n"
									]
								};
								const fuse = new Fuse(words, options);
								var results = fuse.search(t);
								return results[0]?.item.n;
							}).join("\n");
							*/
							this.shoppinglist = text;
						})
						
					});
					fileReader.readAsDataURL(fileList[0]);
				}
			});
			
			fileSelector.showPicker();
		},
		search: function()
		{
			if (this.prices.length == 0)
			{
				setTimeout(function()
				{
					// Still loading prices, wait and retry
					app.search();
				}, 100);
				return;
			}
			
			// Get products from shoppinglist
			this.products = this.shoppinglist.split("\n").filter(product => product.trim() != "").map(product => {return {name: product}})
			this.supermarkets = this.prices;
			
			/* GET TOTAL PRICES PER SUPERMARKET */
			this.supermarkets.map(supermarket =>
			{
				supermarket.totalPrice = 0;
				supermarket.notFound = 0;
				this.products.map(product =>
				{
					var existing = findProduct(supermarket.d, product.name);
				
					if (existing)
					{
						supermarket.totalPrice += existing.p;
					}
					else
					{
						supermarket.notFound++;
					}
				});
			});
			
			// For products without a price, find the highest price among other supermarkets to get an approximation. 
			this.supermarkets.map(supermarket =>
			{
				this.products.map(product =>
				{
					var existing = findProduct(supermarket.d, product.name);
				
					if (!existing)
					{
						var price = 0;
						this.supermarkets.map(supermarket => {
							var existingForOtherSupermarket = findProduct(supermarket.d, product.name);
							if (existingForOtherSupermarket)
							{
								if (existingForOtherSupermarket.p > price)
								{
									price = existingForOtherSupermarket.p;
								}
							}
						})
						supermarket.totalPrice += price;
					}
					
				});
			});
			
			// Sort by price, cheapest total first
			this.supermarkets.sort((a, b) => a.totalPrice - b.totalPrice);
			setTimeout(function()
			{
				document.getElementById("supermarkets").scrollIntoView({behavior: "smooth", block: "start"});
			}, 100);
		},
		select: function()
		{
			// Get products from shoppinglist
			this.products = this.shoppinglist.split("\n").filter(product => product.trim() != "").map(product => {return {name: product}});
			
			// Process products for the selected supermarket and get prices
			this.products.map(product => 
			{
				var existing = findProduct(this.selectSupermarket.d, product.name);
				
				if (existing)
				{
					product.name = existing.n;
					product.price = existing.p;
					product.link = this.selectSupermarket.u + existing.l;
					product.size = convertAmountToBase(existing.s);
				}
				else
				{
					product.price = null;
					product.link = null;
					product.size = "Niet gevonden.";
				}

				return product;
			});
			
			// For products without a price, find the highest price among other supermarkets to get an approximation. 
			this.products.filter(product => !product.price && !product.link).map(product =>
			{
				var price = 0;
			
				this.supermarkets.map(supermarket => {
					var existing = findProduct(supermarket.d, product.name);
					if (existing)
					{
						if (existing.p > price)
						{
							price = existing.p;
						}
					}
				})
				
				product.price = price;
				if (product.price)
				{
					product.size = "Niet gevonden, geschatte prijs.";
				}
				return product;
			});
			
			setTimeout(function()
			{
				document.getElementById("shoppinglist").scrollIntoView({behavior: "smooth", block: "start"});
			}, 100);
		},
		update: function()
		{
			this.selectSupermarket = null;
			this.supermarkets = [];
			localStorage.setItem("shoppinglist", this.shoppinglist);
		},
		clear: function()
		{
			this.shoppinglist = "";
			this.update();
		}
	},
	created: function()
	{
		this.loadPrices();
		this.shoppinglist = localStorage.getItem("shoppinglist");
	},
	filters:
	{
		formatPrice: function(value)
		{
			if (value && value > 0)
			{
				return value.toFixed(2).replace(".", ",");
			}
			else
			{
				return "-";
			}
		},
		formatAmount: function(value)
		{
			var pattern = new RegExp("([\\d]+) (gram|milliliter)", "i");

			if (value && pattern.test(value))
			{
				var amount = value.match(pattern);
				if (amount[2].toLowerCase() == "gram" && amount[1] >= 1000)
				{
					return (amount[1] / 1000) + " kilogram";
				}
				else if (amount[2].toLowerCase() == "milliliter" && amount[1] >= 1000)
				{
					return (amount[1] / 1000) + " liter";
				}
				else
				{
					return value.toLowerCase();
				}
			}
			else
			{
				return value?.toLowerCase();
			}
		}
	}
});

function findProducts(products, name)
{
	var pattern = new RegExp(name.split("").join(".*"), "i");
	// Find all products that include letters from "name" in the same order as the appear in the original.
	var productMatches = products.filter(function(product)
	{
		return pattern.test(product.n);
	});
	// Order productMatches
	productMatches.sort(function (a, b)
	{
		// Order by length of the match of the search string (so "skim milk" goes before "skim coffee milk")
		var aLength = a.n.match(pattern)[0].length;
		var bLength = b.n.match(pattern)[0].length;
		// If lengths match, return the cheapest product
		if (aLength == bLength)
		{
			return a.p - b.p
		}
		return aLength - bLength;
	});
	return productMatches;
}

function findProduct(products, name)
{
	return findProducts(products, name)[0];
}

function convertAmountToBase(value)
{
	var unitofmeasure = 
	[
		{ unit: "gram", name: "g", conversion: 1 },
		{ unit: "gram", name: "gr", conversion: 1 },
		{ unit: "gram", name: "gram", conversion: 1 },
		{ unit: "gram", name: "k", conversion: 1000 },
		{ unit: "gram", name: "kg", conversion: 1000 },
		{ unit: "gram", name: "kilo", conversion: 1000 },
		{ unit: "gram", name: "kilogram", conversion: 1000 },
		{ unit: "gram", name: "pond", conversion: 500 },
		{ unit: "milliliter", name: "ml", conversion: 1 },
		{ unit: "milliliter", name: "milliliter", conversion: 1 },
		{ unit: "milliliter", name: "mililiter", conversion: 1 },
		{ unit: "milliliter", name: "liter", conversion: 1000 },
		{ unit: "milliliter", name: "l", conversion: 1000 },
		{ unit: "milliliter", name: "deciliter", conversion: 10 },
		{ unit: "milliliter", name: "dl", conversion: 10 },
		{ unit: "milliliter", name: "centiliter", conversion: 100 },
		{ unit: "milliliter", name: "cl", conversion: 100 },		
	]
	
	var pattern = new RegExp("([\\d\.,]+) (" + unitofmeasure.map(unit => unit.name).join("|") + ")", "i");
	
	if (value && pattern.test(value))
	{
		var amount = value.match(pattern);
		
		return (amount[1].replace(",", ".") * unitofmeasure.find(unit => unit.name == amount[2].toLowerCase()).conversion) + " " + unitofmeasure.find(unit => unit.name == amount[2].toLowerCase()).unit;
	}
	
	return value;
}