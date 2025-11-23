// Global filters
Vue.filter('formatPrice', function(value)
{
	if (value && value > 0)
	{
		return value.toFixed(2).replace(".", ",");
	}
	else
	{
		return "-";
	}
});

Vue.filter('formatAmount', function(value)
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
});

Vue.filter('formatCount', function(value)
{
	// Add thousand separator
	return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
});

Vue.component('share-button', {
	template: '#share-button-template'
});

Vue.component('supermarket-products', {
	template: '#supermarket-products-template',
	props: ['supermarket', 'showShareButton']
});

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
		isSearching: false,
		shopMultipleSupermarkets: false,
		maxSupermarkets: null,
		availableSupermarkets: [],
		selectedSupermarketCodes: [],
		shoppingPlan: null,
		showSupermarketSelection: false
	},
	watch:
	{
		shopMultipleSupermarkets: function(val)
		{
			if (!val)
			{
				this.showSupermarketSelection = false;
				this.shoppingPlan = null;
			}
			this.supermarkets = [];
			this.selectedSupermarket = null;
			this.saveShoppinglist();
		}
	},
	methods:
	{
		loadSupermarkets: async function()
		{
			try {
				this.availableSupermarkets = await checkjebon.getSupermarkets();
			} catch (e) {
				console.error("Failed to load supermarkets", e);
			}
		},
		createShoppingPlan: async function(scrollToResults = true)
		{
			if (this.selectedSupermarketCodes.length === 0) {
				this.shoppingPlan = null;
				return;
			}
			
			this.isSearching = true;
			const productNames = this.shoppinglist.split("\n").filter(product => product.trim() !== "");
			
			try {
				const result = await checkjebon.getOptimalShoppingPlan(
					productNames,
					this.maxSupermarkets,
					this.selectedSupermarketCodes
				);
				
				// Initialize checked state based on originalQuery
				result.supermarkets.forEach(s => {
					s.products.forEach(p => {
						p.checked = p.originalQuery && p.originalQuery.startsWith("x ");
					});
				});

				this.shoppingPlan = result;
				// Ensure each supermarket in the shopping plan has totalPrice and notFound properties
				this.shoppingPlan.supermarkets = this.shoppingPlan.supermarkets.map(s => ({
					...s,
					products: s.products.map(p => (p)),
					totalPrice: s.products.reduce((sum, p) => sum + (p.price || 0), 0),
					notFound: s.products.filter(p => p.isEstimate).length
				}));
				this.selectedSupermarket = null; // Clear single selection

				// Compute aggregate values for the shopping plan
				// totalCost: sum of assigned products' prices
				this.shoppingPlan.totalCost = this.shoppingPlan.supermarkets.reduce((sum, s) => sum + (s.totalPrice || 0), 0);

				// Compute best single-supermarket total using current product list and selected supermarket codes
				try {
					const allPricesResults = await checkjebon.getPricesForProducts(productNames);
					// Filter to only supermarkets that were selectable for this plan (selectedSupermarketCodes)
					const filtered = allPricesResults.filter(s => this.selectedSupermarketCodes.includes(s.code));
					const singleTotals = filtered.map(s => ({
						code: s.code,
						name: s.name,
						totalPrice: s.products.reduce((sum, p) => sum + (p.price || 0), 0)
					}));
					if (singleTotals.length > 0) {
						const best = singleTotals.reduce((min, s) => s.totalPrice < min.totalPrice ? s : min, singleTotals[0]);
						this.shoppingPlan.bestSingleTotal = best.totalPrice;
						this.shoppingPlan.bestSingleName = best.name;
						this.shoppingPlan.totalSavings = (this.shoppingPlan.bestSingleTotal || 0) - this.shoppingPlan.totalCost;
					} else {
						this.shoppingPlan.bestSingleTotal = null;
						this.shoppingPlan.bestSingleName = null;
						this.shoppingPlan.totalSavings = 0;
					}
				} catch (e) {
					console.error('Failed to compute single-shop totals', e);
					this.shoppingPlan.bestSingleTotal = null;
					this.shoppingPlan.totalSavings = 0;
				}
				
				if (scrollToResults) {
					setTimeout(function()
					{
						document.getElementById("shopping-plan").scrollIntoView({behavior: "smooth", block: "start"});
					}, 100);
				}
				
			} catch (e) {
				alert('Er is een fout opgetreden bij het maken van het winkelplan.');
				console.error(e);
			}
			this.isSearching = false;
		},
		updateShoppingPlan: function()
		{
			if (this.shoppingPlan)
			{
				this.createShoppingPlan(false);
			}
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
		search: async function()
		{
			if (!this.shoppinglist || this.shoppinglist.trim() === "") {
				this.supermarkets = [];
				return;
			}

			if (this.shopMultipleSupermarkets) {
				this.showSupermarketSelection = true;
				this.shoppingPlan = null;
				this.selectedSupermarket = null;
				this.supermarkets = [];
				if (this.availableSupermarkets.length === 0) {
					await this.loadSupermarkets();
				}
				setTimeout(function()
				{
					const el = document.getElementById("supermarket-selection");
					if(el) el.scrollIntoView({behavior: "smooth", block: "start"});
				}, 100);
				return;
			}

			this.isSearching = true;
			this.showSupermarketSelection = false;
			this.shoppingPlan = null;
			const productNames = this.shoppinglist.split("\n").filter(product => product.trim() !== "");
			try {
				const results = await checkjebon.getPricesForProducts(productNames);
				this.pricesLastUpdated = checkjebon.pricesLastUpdated();
				this.supermarkets = results.map(s => ({
					...s,
					products: s.products.map(p => {
						p.checked = p.originalQuery.startsWith("x ");
						return p;
					}),
					totalPrice: s.products.reduce((sum, p) => sum + (p.price || 0), 0),
					notFound: s.products.filter(p => p.isEstimate).length
				}));
				this.supermarkets.sort((a, b) => a.totalPrice - b.totalPrice);
				if (!this.selectedSupermarket) {
					setTimeout(function()
					{
						document.getElementById("supermarkets").scrollIntoView({behavior: "smooth", block: "start"});
					}, 100);
				}
			} catch (e) {
				alert('Er is een fout opgetreden bij het zoeken naar prijzen.');
				console.error(e);
			}
			this.isSearching = false;
		},
		select: function()
		{
			setTimeout(function()
			{
				document.getElementById("articles").scrollIntoView({behavior: "smooth", block: "start"});
			}, 100);
		},
		check: function(product, event)
		{
			// Process checking and unchecking of products
			product.checked = event.target.checked;
			this.shoppinglist = this.shoppinglist.split("\n").map(line => 
			{
				if (line.includes(product.originalQuery))
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
		edit: async function(product, event, message)
		{
			var newProduct = window.prompt(message, product.originalQuery?.replace(/^x\s/, ''));
			if (newProduct)
			{
				this.shoppinglist = this.shoppinglist.split("\n").map(line => 
				{
					if (line.includes(product.originalQuery))
					{
						line = (product.originalQuery.startsWith("x ") ? "x " : "") + newProduct;
					}
					return line;
				}).join("\n");
				this.saveShoppinglist();
				
				const currentCode = this.selectedSupermarket ? this.selectedSupermarket.code : null;
				await this.search();
				
				if (currentCode) {
					this.selectedSupermarket = this.supermarkets.find(s => s.code == currentCode);
				}
			}
		},
		share: async function()
		{
			var hash = this.shoppinglist.replace(/\n/g, "%0A");
			if (this.shopMultipleSupermarkets) {
				hash += "|" + (this.shopMultipleSupermarkets ? "1" : "0");
				hash += "|" + this.maxSupermarkets;
				hash += "|" + this.selectedSupermarketCodes.join(",");
			}
			window.location.hash = hash;
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
			localStorage.setItem("shopMultipleSupermarkets", this.shopMultipleSupermarkets);
			localStorage.setItem("maxSupermarkets", this.maxSupermarkets);
			localStorage.setItem("selectedSupermarketCodes", JSON.stringify(this.selectedSupermarketCodes));
		},
		loadShoppinglist: async function()
		{
			// Populate shoppinglist from memory
			this.shoppinglist = localStorage.getItem("shoppinglist");
			this.shopMultipleSupermarkets = localStorage.getItem("shopMultipleSupermarkets") === "true";
			this.maxSupermarkets = parseInt(localStorage.getItem("maxSupermarkets")) || null;
			try {
				this.selectedSupermarketCodes = JSON.parse(localStorage.getItem("selectedSupermarketCodes")) || [];
			} catch(e) {
				this.selectedSupermarketCodes = [];
			}

			// Override shoppinglist from URL hash, if present
			if (window.location.hash)
			{
				if (!this.shoppinglist || window.confirm("Druk op OK om de lijst die je net opent te gebruiken of Annuleren om verder te gaan met de lijst die je eerder hebt gemaakt."))
				{
					var hashContent = decodeURI(window.location.hash).substr(1);
					var parts = hashContent.split("|");
					this.shoppinglist = parts[0];
					if (parts.length > 1) {
						this.shopMultipleSupermarkets = parts[1] === "1";
						this.maxSupermarkets = parseInt(parts[2]) || null;
						this.selectedSupermarketCodes = parts[3] ? parts[3].split(",") : [];
					}
				}
				window.location.hash = "";
			}

			if (this.shopMultipleSupermarkets && this.shoppinglist && this.shoppinglist.trim() !== '') {
				// Only show the supermarket selection on load when there is a non-empty shopping list.
				this.showSupermarketSelection = true;
				if (this.availableSupermarkets.length === 0) {
					await this.loadSupermarkets();
				}
			
				if (this.maxSupermarkets && this.selectedSupermarketCodes.length > 0) {
					this.createShoppingPlan(true);
				}
			} else {
				// Ensure the supermarket selection and any results are hidden when there's
				// no shopping list during initial page load.
				this.showSupermarketSelection = false;
				this.shoppingPlan = null;
				this.supermarkets = [];
				this.selectedSupermarket = null;
			}
		},
		update: function()
		{
			this.selectedSupermarket = null;
			this.supermarkets = [];
			
			if (this.shopMultipleSupermarkets)
			{
				this.showSupermarketSelection = false;
				this.shoppingPlan = null;
			}

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
		this.loadShoppinglist();
	}
});
