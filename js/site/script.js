var app = new Vue(
{
	el: "#checkjebon",
	data:
	{
		prices: [],
		pricesLastUpdated: null,
		shoppinglist: "",
		products: [],
		supermarkets: [],
		selectedSupermarket: null,
		isSearching: false
	},
	methods:
	{
		loadPrices: function()
		{
			fetch("data/supermarkets.json").then((response) =>
			{
				this.pricesLastUpdated = new Date(response.headers.get("Last-Modified")).toLocaleString();
				return response.json();
			}).then((prices) =>
			{
				this.prices = prices;
			});
		},
		example: function()
		{
			this.shoppinglist = "1,5 liter halfvolle melk\nKnoflooksaus\n400 g shoarma\nPita brood\nKipschnitzel\n250 gram kipfilet\n1 kilo bananen\n1 liter coca cola\nkokosbrood\n500 ml soep\nhalvarine\n";
			this.saveShoppinglist();
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
							text = text.toLowerCase().replace(/([^a-zA-Z\s])+/g, "");
							// Remove all words that are 3 or less characters
							text = text.replace(/\b([a-zA-Z]){0,3}\b/g, "");
							// Trim results
							text = text.split("\n").map(t => t.trim()).join("\n");
							// Remove empty lines
							text = text.trim().replace(/\n{2,}/g, "\n");
							// Use fuzzy search logic to find closest match in an attempt to fix reading errors
							var words = [... new Set(app.prices.map(p => p.d).flat().map(p => p.n.toLowerCase().split(" ")).flat())].filter(p => p.length > 4);
							var ignoredWords = ["prijs", "aantal", "e-prijs", "actieprijs", "kassa", "lade", "omschrijving", "subtotaal", "totaal"];
							words = words.concat(ignoredWords);
							text = text.split("\n").filter(line => line.trim() != "").map((line, i) =>
							{
								// Update status
								this.shoppinglist = "matching: " + (i / text.split("\n").length * 100).toFixed(0) + "%";
								// Find closest match
								return line.split(/\s/).map(word => 
								{
									const options = {
										shouldSort: true,
										threshold: 0.4,
									};
									// Find closest match using words that somewhat match in length
									const fuse = new Fuse(words.filter(w => Math.abs(w.length - word.length) < 3), options);
									var results = fuse.search(word);
									// Exclude ignored words
									var result = results[0]?.item || word
									if (ignoredWords.includes(result))
									{
										return "";
									}
									// Return result
									return result;
								}).join(" ");								
							}).join("\n");
							// Capitalize first letter of each word
							text = text.replace(/\b[a-z]/g, letter => letter.toUpperCase());
							// Update shoppinglist
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
				this.isSearching = true;
				setTimeout(function()
				{
					// Still loading prices, wait and retry
					app.search();
				}, 100);
				return;
			}
			
			// Get products from shoppinglist
			this.products = this.shoppinglist.split("\n").filter(product => product.trim() != "").map(product => {
				var checked = false;
				if (product.startsWith("x "))
				{
					product = product.substring(2);
					checked = true;
				}
				return {name: product, checked: checked};
			});
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

			this.isSearching = false;
		},
		select: function()
		{
			// Get products from shoppinglist
			this.products = this.shoppinglist.split("\n").filter(product => product.trim() != "").map(product => {
				var checked = false;
				if (product.startsWith("x "))
				{
					product = product.substring(2);
					checked = true;
				}
				return {name: product, originalProduct: product, checked: checked};
			});
			
			// Process products for the selected supermarket and get prices
			this.products.map(product => 
			{
				var existing = findProduct(this.selectedSupermarket.d, product.name);
				
				if (existing)
				{
					product.name = existing.n;
					product.price = existing.p;
					product.link = this.selectedSupermarket.u + existing.l;
					product.size = convertAmountToBase(existing.s);
				}
				else
				{
					product.price = null;
					product.link = null;
					product.size = "Niet gevonden";
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
					product.size = "Niet gevonden, geschatte prijs";
				}
				return product;
			});
			
			setTimeout(function()
			{
				document.getElementById("shoppinglist").scrollIntoView({behavior: "smooth", block: "start"});
			}, 100);
		},
		check: function(product, event)
		{
			// Process checking and unchecking of products
			product.checked = event.target.checked;
			this.shoppinglist = this.shoppinglist.split("\n").map(line => 
			{
				if (line.includes(product.originalProduct))
				{
					if (line.startsWith("x "))
					{
						line = line.substring(2);
					}
					if (product.checked)
					{
						line = "x " + line;
					}
				}
				return line;
			}).join("\n");
			this.saveShoppinglist();
		},
		edit: function(product, event)
		{
			var newProduct = window.prompt(`Bedoelde je soms iets anders? Pas dan de naam van dit product aan.\n\nTip: Hoe specifiek je bent, hoe beter het resultaat. Gebruik bijvoorbeeld "smeerboter" in plaats van "boter" of "1,5 liter halfvolle melk" in plaats van alleen "melk".`, product.originalProduct);
			if (newProduct)
			{
				this.shoppinglist = this.shoppinglist.split("\n").map(line => 
				{
					if (line.includes(product.originalProduct))
					{
						line = newProduct;
					}
					return line;
				}).join("\n");
				this.saveShoppinglist();
				this.select();
			}
		},
		share: async function()
		{
			window.location.hash = this.shoppinglist.replace(/\n/g, "%0A");
			var shared = false;
			// Share the shoppinglist using the device's share functionality
			if (navigator.share)
			{
				try
				{
					await navigator.share(
					{
						title: "Checkjebon.nl",
						text: "Je boodschappenlijst van Checkjebon.nl",
						url: window.location.href
					});
					shared = true;
				}
				catch(e)
				{
					console.log('Error sharing link', e);
				}
			}
			// Share the shoppinglist via email
			if (!shared)
			{
				var body = `Hoi, hier is je boodschappenlijst:`;
				body += `%0A%0A`;
				body += encodeURIComponent(this.shoppinglist.split("\n").map(p => "- " + p.trim()).filter(p => p).join("\n"));
				if (this.selectedSupermarket)
				{
					body += `%0A%0A`;
					body += `De totaalprijs bij ${this.selectedSupermarket.c} komt uit op ${this.$options.filters.formatPrice(this.selectedSupermarket.totalPrice)} euro.`;
				}
				body += `%0A%0A`;
				body += `Ga verder met deze boodschappenlijst via de link hieronder.%0A%0A`;
				body += encodeURIComponent(window.location.href);
				window.location = `mailto:?subject=Checkjebon.nl - boodschappenlijst&body=${body}`;
			}
			window.location.hash = "";
		},
		saveShoppinglist: function()
		{
			localStorage.setItem("shoppinglist", this.shoppinglist);
		},
		loadShoppinglist: function()
		{
			// Populate shoppinglist from memory
			this.shoppinglist = localStorage.getItem("shoppinglist");
			// Override shoppinglist from URL hash, if present
			if (window.location.hash)
			{
				if (!this.shoppinglist || window.confirm("Druk op OK om de lijst die je net opent te gebruiken of Annuleren om verder te gaan met de lijst die je eerder hebt gemaakt."))
				{
					this.shoppinglist = decodeURI(window.location.hash).substr(1);
				}
				window.location.hash = "";
			}
		},
		update: function()
		{
			this.selectedSupermarket = null;
			this.supermarkets = [];
			this.saveShoppinglist();
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
		this.loadShoppinglist();
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
		},
		formatCount: function(value)
		{
			// Add thousand separator
			return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
		},
	}
});

function findProducts(products, value)
{
	// If there is any indication of an amount, remove it from the search query.
	var amount = getAmount(value);
	if (amount)
	{
		value = value.replace(amount, "");
	}
	// Find all products that include all words from the search query value.
	var patterns = value.trim().split(/\s/g).filter(p => p).map(p => new RegExp(p.replace(/\s/g, ""), "i"));
	var productMatches = products.filter(function(product)
	{
		return patterns.every(pattern => pattern.test(product.n));
	});
	// Fallback: If there were no matches, find all products that include letters from "value" in the same order as the appear in the original.
	if (productMatches.length == 0)
	{
		patterns = [new RegExp(value.replace(/\s/g, "").split("").join(".*"), "i")];
		productMatches = products.filter(function(product)
		{
			return patterns.every(pattern => pattern.test(product.n));
		});
	}
	// When an amount is specified, return the product that meets this minimum amount.	
	if (amount)
	{
		var baseAmount = convertAmountToBase(amount);
		productMatches = productMatches.filter(product => compareMinimumAmounts(convertAmountToBase(product.s), baseAmount));
	}
	// Order productMatches
	productMatches.sort(function (a, b)
	{
		// Order by length of the pattern match (so "skim milk" goes before "skim coffee milk")
		var aLength = patterns.reduce((acc, pattern) => acc + a.n.match(pattern)[0].length, 0);
		var bLength = patterns.reduce((acc, pattern) => acc + b.n.match(pattern)[0].length, 0);
		// If lengths are a close enough match, return the cheapest product
		if (Math.abs(aLength - bLength) < 3)
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

var unitofmeasures = 
[
	{ unit: "gram", name: "gram", conversion: 1 },
	{ unit: "gram", name: "gr", conversion: 1 },
	{ unit: "gram", name: "g", conversion: 1 },
	{ unit: "gram", name: "kilogram", conversion: 1000 },
	{ unit: "gram", name: "kilo", conversion: 1000 },
	{ unit: "gram", name: "kg", conversion: 1000 },
	{ unit: "gram", name: "k", conversion: 1000 },
	{ unit: "gram", name: "pond", conversion: 500 },
	{ unit: "milliliter", name: "milliliter", conversion: 1 },
	{ unit: "milliliter", name: "mililiter", conversion: 1 },
	{ unit: "milliliter", name: "ml", conversion: 1 },
	{ unit: "milliliter", name: "liter", conversion: 1000 },
	{ unit: "milliliter", name: "l", conversion: 1000 },
	{ unit: "milliliter", name: "deciliter", conversion: 100 },
	{ unit: "milliliter", name: "dl", conversion: 100 },
	{ unit: "milliliter", name: "centiliter", conversion: 10 },
	{ unit: "milliliter", name: "cl", conversion: 10 },		
]

var unitofmeasurePattern = new RegExp("([\\d\.,]+)\\s?(" + unitofmeasures.map(unit => unit.name).join("|") + ")", "i");

function getAmount(value)
{
	var amount = value.match(unitofmeasurePattern);
	if (amount)
	{
		return amount[0];
	}
	else
	{
		return null;
	}
}

function convertAmountToBase(value)
{
	if (value && unitofmeasurePattern.test(value))
	{
		var amount = value.match(unitofmeasurePattern);
		
		return (amount[1].replace(",", ".") * unitofmeasures.find(unit => unit.name == amount[2].toLowerCase()).conversion) + " " + unitofmeasures.find(unit => unit.name == amount[2].toLowerCase()).unit;
	}
	
	return value;
}

function compareMinimumAmounts(productAmount, searchAmount)
{
	var productAmountValue = parseInt(productAmount.match(/([0-9]+)/));
	var searchAmountValue = parseInt(searchAmount.match(/([0-9]+)/));
	var productAmountUnit = productAmount.match(/([a-z]+)/i);
	var searchAmountUnit = searchAmount.match(/([a-z]+)/i);

	if (productAmountUnit && searchAmountUnit)
	{
		productAmountUnit = productAmountUnit[0];
		searchAmountUnit = searchAmountUnit[0];
	}

	if (productAmountUnit == searchAmountUnit && productAmountValue >= searchAmountValue)
	{
		return true;
	}
	else
	{
		return false;
	}
}
