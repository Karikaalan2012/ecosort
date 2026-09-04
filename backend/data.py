"""
data.py — static reference data for EcoSort.

CATEGORY_KEYWORDS maps fragments of ImageNet / MobileNet class labels
(what the client-side vision model returns) to a waste stream. We use
keyword containment matching rather than an exact lookup table because
MobileNet's 1000 ImageNet classes use oddly specific names
(e.g. "pop_bottle", "beer_bottle", "water_bottle" should all resolve to
the same "recyclable" stream).
"""

CATEGORY_KEYWORDS = {
    # Glass, metal, rigid plastic, and paper containers/packaging.
    # Short, generic fragments like "bottle" and "jar" deliberately catch
    # every ImageNet variant (pop_bottle, beer_bottle, water_bottle, ...)
    # via substring matching, so we don't need to list every synonym.
    "recyclable": [
        "bottle", "jar", "tin_can", "milk_can", "carton", "envelope",
        "newspaper", "cardboard", "magazine", "book_jacket", "dust_jacket",
        "comic_book", "crossword", "menu", "packet", "paperback", "goblet",
        "corkscrew", "can_opener", "aluminum", "soda", "wine_bottle",
        "beer_bottle", "beer_glass", "water_bottle", "pop_bottle",
        "ring_binder", "carton", "cup",
    ],
    # Food scraps, produce, and other organics.
    "compost": [
        "banana", "orange", "lemon", "apple", "granny_smith", "pineapple",
        "strawberry", "broccoli", "cucumber", "mushroom", "corn", "fig",
        "pomegranate", "artichoke", "zucchini", "bell_pepper", "cabbage",
        "squash", "cauliflower", "jackfruit", "custard_apple", "hay",
        "dough", "meatloaf", "pizza", "pot_pie", "burrito", "mashed_potato",
        "guacamole", "consomme", "hot_pot", "trifle", "ice_cream", "ice_pop",
        "baguette", "bagel", "pretzel", "cheeseburger", "hot_dog",
        "carbonara", "chocolate_syrup", "espresso", "eggnog", "acorn",
        "rose_hip", "horse_chestnut", "coral_fungus", "agaric", "gyromitra",
        "stinkhorn", "earthstar", "hen-of-the-woods", "bolete", "ear_of_corn",
        "cardoon", "spaghetti_squash", "acorn_squash", "butternut_squash",
        "coffee",
    ],
    # Electronics/e-waste, batteries, chemicals, medical & sharp items.
    "hazardous": [
        "battery", "syringe", "lighter", "spray_can", "thermometer",
        "fluorescent", "paint", "gasoline", "cell_phone", "mobile_phone",
        "remote_control", "ipod", "laptop", "notebook_computer",
        "desktop_computer", "hand-held_computer", "hard_disk", "printer",
        "photocopier", "power_drill", "chainsaw", "cleaver", "guillotine",
        "hatchet", "gas_mask", "oxygen_mask", "medicine_chest", "pill_bottle",
        "revolver", "rifle", "assault_rifle", "missile", "projectile",
        "cannon", "tank", "match", "space_heater", "television",
        "vacuum_cleaner", "washing_machine", "dishwasher", "refrigerator",
        "hair_dryer", "hair_spray", "espresso_machine", "coffeemaker",
        "crock_pot", "toaster", "waffle_iron", "oscilloscope", "joystick",
        "modem", "monitor", "radio", "cassette_player", "cd_player",
        "computer_mouse", "computer_keyboard", "electric_fan", "microwave",
        "digital_watch", "digital_clock",
    ],
    # Soft plastics, textiles, ceramics, and other non-recyclable, non-food items.
    # Listed explicitly (rather than relying only on the fallback) so common
    # everyday trash resolves deliberately instead of by default.
    "landfill": [
        "diaper", "styrofoam", "plastic_bag", "wrapper", "cigarette",
        "eraser", "shower_cap", "sponge", "toilet_paper", "toilet_tissue",
        "paper_towel", "sock", "mitten", "t-shirt", "jean", "swimsuit",
        "bikini", "sweatshirt", "cardigan", "poncho", "kimono", "gown",
        "pajama", "wig", "fur_coat", "trench_coat", "suit", "running_shoe",
        "cowboy_boot", "sandal", "clog", "teddy_bear", "balloon", "pinwheel",
        "coffee_mug", "mug", "vase", "teapot",
    ],
}

CATEGORY_TIPS = {
    "recyclable": {
        "label": "Recyclable",
        "color": "#2E7DD6",
        "tip": "Rinse residue out and drop it in the blue bin. Flatten cartons and boxes to save space.",
    },
    "compost": {
        "label": "Compost",
        "color": "#4C9A2A",
        "tip": "Food scraps and yard waste go in the green bin. Skip anything oily or meat-heavy if you're home composting.",
    },
    "hazardous": {
        "label": "Hazardous / E-Waste",
        "color": "#D6472E",
        "tip": "Never bin this. Drop it at a designated e-waste or household hazardous waste depot.",
    },
    "landfill": {
        "label": "Landfill",
        "color": "#4A4A4A",
        "tip": "Not recyclable or compostable in most municipal programs — goes in the black/grey bin.",
    },
}

# Mock municipal pickup calendar by zone code
ZONE_SCHEDULES = {
    "A": {"recyclable": "Monday", "compost": "Wednesday", "landfill": "Friday"},
    "B": {"recyclable": "Tuesday", "compost": "Thursday", "landfill": "Monday"},
    "C": {"recyclable": "Wednesday", "compost": "Friday", "landfill": "Tuesday"},
    "D": {"recyclable": "Thursday", "compost": "Monday", "landfill": "Wednesday"},
}

POINTS_PER_SCAN = 10
POINTS_PER_REPORT = 25


def match_category(raw_label: str):
    """Return the matched category, or None if raw_label hits no keyword at all."""
    label = raw_label.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(k in label for k in keywords):
            return category
    return None


def classify_label(raw_label: str) -> str:
    """Map a raw vision-model label to one of the four waste streams."""
    return match_category(raw_label) or "landfill"  # safe default for unrecognized items