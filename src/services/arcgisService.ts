/**
 * ArcGIS Service
 * Fetches building polygons from ArcGIS Feature Service with error handling
 * and writes back enumeration status + customer points.
 *
 * NOTE: All spatial queries use HTTP POST with application/x-www-form-urlencoded
 * body instead of GET with URL query parameters. The GET URLs exceed ~600 chars
 * and are silently dropped by the network path in the field (HTTP 000 / empty
 * response on long GET, HTTP 200 with full results on POST).
 * Ref: Fix Specification — arcgis_service.dart (Backend Team, 2026-03-10)
 *
 * v1.58.3 — Added write-back:
 *   updatePolygonAfterRegistration()  — marks polygon as Enumerated on unit save
 *   upsertCustomerPoint()             — creates/updates a point per unit in Customer Layer
 */

import type {
  BuildingPolygon,
  ArcGISQueryResponse,
  ArcGISFeature,
} from '../models/BuildingPolygon';
import {
  calculatePolygonCenter,
} from '../utils/coordinateConversion';
// NOTE: convertArcGISRingsToWGS84 is intentionally NOT imported.
// The new Nigeria_Building_Footprints layer stores rings in WGS84 (EPSG:4326) natively.
// Applying the Web Mercator conversion would corrupt coordinates.

// ─── Endpoint constants ───────────────────────────────────────────────────────

/** Building polygon layer (parent) — Nigeria_Building_Footprints (WGS84 native, replaced 2026-04-07) */
const ARCGIS_POLYGON_URL =
  'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/Nigeria_Building_Footprints/FeatureServer/0';

/** Customer point layer (child) */
const ARCGIS_CUSTOMER_URL =
  'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/Customer_Layer_gdb/FeatureServer/0';

// Keep the legacy alias so existing read-only callers are unaffected
const ARCGIS_BASE_URL = ARCGIS_POLYGON_URL;

// ArcGIS API Key
const ARCGIS_API_KEY =
  'AAPTxy8BH1VEsoebNVZXo8HurDkT4HeplNOm_pLCsV2-wHXD7esJFqWCGo3oDxTaOVO68fIzhjQ4gSKqccl-uynuHunhlN5t3E_x5N010mOKYQRyFm3vYXqvila3dJ3Ax81DMK2WyxFt6mqhwzxdkdhmm7USv7-cQi07L_22-MTRC95Rns1BHueP3kR_yXyAyh1WEFAm9Q7KFELPkRpT_5cjWvbDo2rWZhtHOb5xFr_7bOA.AT1_n5wNkDcc';

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 15000;
/**
 * Pre-computed geographic center coordinates for each ArcGIS Lot_ID.
 * Used to center the map on the correct lot when starting enumeration,
 * regardless of the device GPS position.
 * Generated from ArcGIS Nigeria_Building_Footprints layer (sample of 20 buildings per lot).
 */
export const LOT_CENTERS: Record<string, [number, number]> = {
  "LOT-1": [6.635197, 3.350764],
  "LOT-2": [6.633281, 3.357737],
  "LOT-3": [6.601333, 3.35132],
  "LOT-4": [6.622041, 3.356923],
  "LOT-5": [6.612562, 3.33472],
  "LOT-6": [6.57795, 3.356239],
  "LOT-7": [6.626637, 3.352586],
  "LOT-8": [6.638219, 3.353084],
  "LOT-9": [6.645501, 3.348451],
  "LOT-10": [6.65455, 3.349375],
  "LOT-11": [6.5913, 3.378625],
  "LOT-12": [6.565491, 3.353496],
  "LOT-13": [6.600139, 3.313152],
  "LOT-14": [6.594224, 3.363713],
  "LOT-15": [6.598164, 3.362954],
  "LOT-16": [6.597296, 3.349589],
  "LOT-17": [6.605817, 3.345373],
  "LOT-18": [6.577789, 3.364583],
  "LOT-19": [6.608999, 3.309647],
  "LOT-20": [6.625614, 3.310045],
  "LOT-21": [6.620131, 3.331323],
  "LOT-22": [6.636499, 3.30352],
  "LOT-23": [6.626485, 3.322294],
  "LOT-24": [6.613325, 3.327437],
  "LOT-25": [6.63345, 3.301862],
  "LOT-26": [6.642735, 3.314169],
  "LOT-28": [6.62373, 3.306346],
  "LOT-29": [6.623922, 3.313156],
  "LOT-30": [6.621056, 3.324402],
  "LOT-31": [6.630742, 3.313281],
  "LOT-32": [6.45765, 3.336837],
  "LOT-33": [6.469208, 3.342846],
  "LOT-34": [6.445308, 3.336455],
  "LOT-35": [6.45808, 3.328133],
  "LOT-36": [6.466824, 3.337517],
  "LOT-37": [6.445399, 3.340836],
  "LOT-38": [6.453348, 3.346497],
  "LOT-39": [6.452511, 3.336409],
  "LOT-40": [6.460364, 3.344081],
  "LOT-41": [6.442172, 3.334541],
  "LOT-42": [6.444988, 3.345568],
  "LOT-43": [6.460461, 3.352232],
  "LOT-44": [6.451017, 3.345984],
  "LOT-45": [6.463448, 3.348918],
  "LOT-46": [6.469956, 3.346542],
  "LOT-47": [6.457652, 3.346648],
  "LOT-48": [6.581758, 3.266724],
  "LOT-49": [6.603338, 3.240128],
  "LOT-50": [6.610692, 3.266603],
  "LOT-51": [6.667514, 3.267959],
  "LOT-53": [6.553892, 3.249875],
  "LOT-54": [6.615484, 3.279244],
  "LOT-55": [6.535434, 3.283688],
  "LOT-56": [6.658289, 3.277711],
  "LOT-57": [6.548024, 3.269383],
  "LOT-58": [6.609087, 3.262701],
  "LOT-59": [6.597838, 3.308152],
  "LOT-61": [7.365544, 3.882639],
  "LOT-63": [6.593039, 3.281937],
  "LOT-64": [6.534716, 3.249358],
  "LOT-65": [6.622427, 3.258022],
  "LOT-66": [6.598085, 3.244355],
  "LOT-67": [6.621376, 3.266943],
  "LOT-68": [6.54693, 3.232842],
  "LOT-69": [6.578763, 3.283942],
  "LOT-70": [6.637419, 3.270404],
  "LOT-71": [6.608009, 3.261116],
  "LOT-72": [6.584946, 3.306858],
  "LOT-73": [6.533036, 3.265378],
  "LOT-74": [6.583069, 3.257033],
  "LOT-75": [6.533566, 3.22834],
  "LOT-77": [6.600561, 3.296734],
  "LOT-78": [6.600917, 3.3017],
  "LOT-79": [6.539983, 3.236138],
  "LOT-81": [6.600107, 3.247296],
  "LOT-82": [6.581605, 3.288485],
  "LOT-83": [6.526455, 3.259269],
  "LOT-84": [6.430938, 3.317762],
  "LOT-85": [6.455994, 3.305805],
  "LOT-86": [6.473939, 3.253919],
  "LOT-88": [6.456168, 3.273125],
  "LOT-89": [6.467192, 3.251069],
  "LOT-90": [6.451327, 3.267134],
  "LOT-91": [6.485657, 3.288817],
  "LOT-92": [6.470421, 3.322845],
  "LOT-93": [6.48002, 3.282077],
  "LOT-94": [6.427556, 3.336115],
  "LOT-95": [6.479928, 3.275434],
  "LOT-97": [6.451508, 3.241189],
  "LOT-98": [6.434166, 3.340849],
  "LOT-100": [6.441274, 3.350529],
  "LOT-101": [6.448824, 3.372433],
  "LOT-102": [6.465063, 3.358839],
  "LOT-103": [6.475319, 3.352151],
  "LOT-104": [6.469977, 3.352732],
  "LOT-105": [6.466884, 3.368556],
  "LOT-106": [6.468961, 3.359464],
  "LOT-109": [6.472358, 3.346112],
  "LOT-110": [6.619409, 3.569952],
  "LOT-111": [6.492438, 3.074243],
  "LOT-112": [6.57308, 3.55341],
  "LOT-113": [6.620965, 3.531665],
  "LOT-114": [6.611665, 3.524457],
  "LOT-115": [6.578097, 3.563344],
  "LOT-116": [6.656562, 3.525965],
  "LOT-118": [6.617819, 3.529523],
  "LOT-119": [6.616144, 3.509301],
  "LOT-120": [6.597102, 3.604855],
  "LOT-121": [6.598564, 3.596905],
  "LOT-122": [6.493302, 3.095977],
  "LOT-123": [6.633872, 3.5832],
  "LOT-124": [6.586887, 3.52714],
  "LOT-125": [6.626032, 3.596982],
  "LOT-126": [6.615121, 3.501481],
  "LOT-127": [6.641781, 3.578137],
  "LOT-128": [6.643301, 3.606136],
  "LOT-129": [6.432358, 3.086285],
  "LOT-130": [6.593837, 4.0104],
  "LOT-131": [6.577608, 3.970859],
  "LOT-132": [6.631615, 3.985806],
  "LOT-133": [6.593823, 3.969857],
  "LOT-134": [6.65704, 4.078139],
  "LOT-135": [6.597931, 3.984993],
  "LOT-136": [6.641084, 3.804022],
  "LOT-137": [6.654049, 3.996543],
  "LOT-138": [6.645494, 3.780048],
  "LOT-139": [6.611717, 3.900222],
  "LOT-140": [6.662602, 3.737647],
  "LOT-141": [6.591496, 3.977325],
  "LOT-142": [6.509635, 3.627434],
  "LOT-143": [6.646321, 3.711157],
  "LOT-144": [6.591052, 3.982812],
  "LOT-145": [6.632301, 3.993528],
  "LOT-146": [6.587304, 3.984252],
  "LOT-147": [6.545846, 4.079752],
  "LOT-148": [6.638343, 3.710523],
  "LOT-149": [6.499044, 3.580833],
  "LOT-150": [6.445414, 3.586787],
  "LOT-151": [6.427726, 3.426997],
  "LOT-152": [6.479453, 3.581524],
  "LOT-153": [6.443091, 3.444459],
  "LOT-154": [6.477514, 3.583841],
  "LOT-155": [6.456456, 3.411646],
  "LOT-156": [6.426817, 3.489051],
  "LOT-157": [6.434542, 3.487432],
  "LOT-158": [6.406802, 3.394939],
  "LOT-159": [6.456909, 3.432876],
  "LOT-160": [6.436495, 3.445608],
  "LOT-161": [6.445249, 3.520557],
  "LOT-162": [6.421598, 3.451254],
  "LOT-163": [6.431909, 3.416007],
  "LOT-164": [6.445923, 3.413312],
  "LOT-165": [6.448967, 3.421773],
  "LOT-166": [6.508612, 3.583136],
  "LOT-167": [6.433955, 3.531783],
  "LOT-168": [6.432663, 3.520978],
  "LOT-169": [6.481672, 3.857459],
  "LOT-170": [6.440022, 3.833831],
  "LOT-171": [6.439284, 3.992294],
  "LOT-172": [6.423321, 4.118176],
  "LOT-173": [6.536013, 3.884113],
  "LOT-174": [6.482346, 3.823967],
  "LOT-175": [6.48467, 3.724934],
  "LOT-176": [6.483857, 3.783113],
  "LOT-177": [6.431608, 3.98548],
  "LOT-178": [6.418836, 4.155836],
  "LOT-179": [6.396351, 4.206341],
  "LOT-180": [6.43676, 3.944261],
  "LOT-181": [6.686249, 3.268602],
  "LOT-182": [6.644207, 3.337983],
  "LOT-183": [6.661561, 3.30064],
  "LOT-184": [6.643033, 3.33882],
  "LOT-185": [6.643049, 3.327803],
  "LOT-186": [6.661786, 3.310891],
  "LOT-187": [6.668254, 3.276363],
  "LOT-188": [6.650032, 3.334201],
  "LOT-189": [6.660254, 3.309273],
  "LOT-190": [6.663738, 3.294555],
  "LOT-191": [6.632136, 3.339262],
  "LOT-192": [6.658996, 3.35188],
  "LOT-193": [6.673216, 3.313518],
  "LOT-194": [6.675247, 3.271047],
  "LOT-195": [6.609464, 3.671511],
  "LOT-196": [6.541957, 3.498584],
  "LOT-197": [6.556805, 3.493252],
  "LOT-198": [6.553676, 3.531854],
  "LOT-199": [6.616446, 3.497276],
  "LOT-201": [6.607289, 3.527535],
  "LOT-202": [6.679014, 3.478715],
  "LOT-203": [6.561468, 3.494685],
  "LOT-204": [6.67166, 3.520477],
  "LOT-205": [6.56623, 3.62552],
  "LOT-206": [6.630534, 3.501126],
  "LOT-207": [6.576537, 3.604858],
  "LOT-208": [6.649782, 3.601275],
  "LOT-209": [6.604181, 3.510899],
  "LOT-210": [6.639222, 3.528792],
  "LOT-211": [6.62963, 3.482973],
  "LOT-212": [6.650211, 3.56994],
  "LOT-213": [6.600616, 3.574735],
  "LOT-214": [6.681541, 3.579365],
  "LOT-215": [6.661928, 3.502228],
  "LOT-216": [6.597017, 3.569193],
  "LOT-217": [6.650072, 3.581756],
  "LOT-218": [6.661888, 3.581742],
  "LOT-219": [6.602113, 3.623866],
  "LOT-222": [6.620225, 3.473057],
  "LOT-224": [6.61756, 3.504835],
  "LOT-225": [6.601051, 3.388618],
  "LOT-226": [6.61, 3.396572],
  "LOT-227": [6.624834, 3.381424],
  "LOT-228": [6.630389, 3.379381],
  "LOT-229": [6.567998, 3.397576],
  "LOT-230": [6.593611, 3.403711],
  "LOT-231": [6.632332, 3.388021],
  "LOT-232": [6.627371, 3.377267],
  "LOT-233": [6.629865, 3.416968],
  "LOT-234": [6.62786, 3.381163],
  "LOT-235": [6.605328, 3.396255],
  "LOT-236": [6.558837, 3.388149],
  "LOT-237": [6.611921, 3.4118],
  "LOT-238": [6.560393, 3.399628],
  "LOT-239": [6.622984, 3.379322],
  "LOT-240": [6.577283, 3.392241],
  "LOT-241": [6.601671, 3.376022],
  "LOT-242": [6.596821, 3.376211],
  "LOT-243": [6.618867, 3.384503],
  "LOT-244": [6.590132, 3.396389],
  "LOT-245": [6.610782, 3.378502],
  "LOT-246": [6.604147, 3.422118],
  "LOT-247": [6.452842, 3.400169],
  "LOT-248": [6.459179, 3.388816],
  "LOT-249": [6.444115, 3.403722],
  "LOT-250": [6.453264, 3.390752],
  "LOT-251": [6.45521, 3.392912],
  "LOT-252": [6.447678, 3.399913],
  "LOT-253": [6.456261, 3.390128],
  "LOT-254": [6.458263, 3.384321],
  "LOT-255": [6.456041, 3.396488],
  "LOT-256": [6.45673, 3.393582],
  "LOT-257": [6.459926, 3.392326],
  "LOT-258": [6.456399, 3.386474],
  "LOT-259": [6.453802, 3.39812],
  "LOT-260": [6.459392, 3.381991],
  "LOT-261": [6.463227, 3.390285],
  "LOT-262": [6.460067, 3.38662],
  "LOT-263": [6.452924, 3.40465],
  "LOT-264": [6.458034, 3.390654],
  "LOT-265": [6.462413, 3.38846],
  "LOT-266": [6.450659, 3.392532],
  "LOT-267": [6.506149, 3.379341],
  "LOT-268": [6.489741, 3.385401],
  "LOT-269": [6.511629, 3.370923],
  "LOT-270": [6.483303, 3.369796],
  "LOT-271": [6.494184, 3.381008],
  "LOT-272": [6.511107, 3.386701],
  "LOT-273": [6.481721, 3.389053],
  "LOT-274": [6.497182, 3.388043],
  "LOT-275": [6.496419, 3.393509],
  "LOT-276": [6.482991, 3.374864],
  "LOT-277": [6.484545, 3.382713],
  "LOT-278": [6.503805, 3.386587],
  "LOT-279": [6.473035, 3.379436],
  "LOT-280": [6.489495, 3.37275],
  "LOT-281": [6.496096, 3.380409],
  "LOT-282": [6.525468, 3.380077],
  "LOT-283": [6.478845, 3.377529],
  "LOT-284": [6.481138, 3.38593],
  "LOT-285": [6.529668, 3.349453],
  "LOT-286": [6.587525, 3.369416],
  "LOT-287": [6.5274, 3.361987],
  "LOT-288": [6.503225, 3.329974],
  "LOT-289": [6.521769, 3.344451],
  "LOT-290": [6.535375, 3.34386],
  "LOT-291": [6.536975, 3.364724],
  "LOT-292": [6.547915, 3.369828],
  "LOT-293": [6.514431, 3.348124],
  "LOT-295": [6.525458, 3.341975],
  "LOT-296": [6.521284, 3.364748],
  "LOT-297": [6.511625, 3.335039],
  "LOT-298": [6.535454, 3.35781],
  "LOT-299": [6.542411, 3.359695],
  "LOT-300": [6.539444, 3.36306],
  "LOT-301": [6.517635, 3.345326],
  "LOT-302": [6.616926, 3.374276],
  "LOT-303": [6.50526, 3.331252],
  "LOT-304": [6.4644, 3.16881],
  "LOT-305": [6.493488, 3.150158],
  "LOT-306": [6.456714, 3.156289],
  "LOT-307": [6.485932, 3.190758],
  "LOT-308": [6.455768, 3.184709],
  "LOT-309": [6.448314, 3.148978],
  "LOT-310": [6.45773, 3.206623],
  "LOT-311": [6.475352, 3.174791],
  "LOT-312": [6.511314, 3.203525],
  "LOT-313": [6.404975, 3.182178],
  "LOT-314": [6.424021, 3.177081],
  "LOT-315": [6.498541, 3.192188],
  "LOT-316": [6.475039, 3.22447],
  "LOT-317": [6.464267, 3.192987],
  "LOT-318": [6.496392, 3.157422],
  "LOT-319": [6.556192, 3.293809],
  "LOT-320": [6.492128, 3.316414],
  "LOT-321": [6.530183, 3.325196],
  "LOT-322": [6.556816, 3.325039],
  "LOT-323": [6.535506, 3.319473],
  "LOT-324": [6.63299, 3.3775],
  "LOT-325": [6.56066, 3.312596],
  "LOT-326": [6.567256, 3.295574],
  "LOT-327": [6.582866, 3.342229],
  "LOT-328": [6.568138, 3.331586],
  "LOT-329": [6.527343, 3.312985],
  "LOT-330": [6.534914, 3.299846],
  "LOT-331": [6.63299, 3.3775],
  "LOT-332": [6.524033, 3.326883],
  "LOT-333": [6.516153, 3.330521],
  "LOT-334": [6.555834, 3.344859],
  "LOT-335": [6.533091, 3.330356],
  "LOT-336": [6.504915, 3.306609],
  "LOT-337": [6.550479, 3.30633],
  "LOT-338": [6.63299, 3.3775],
  "LOT-339": [6.61865, 3.380056],
  "LOT-340": [6.594811, 3.375395],
  "LOT-341": [6.527262, 3.379955],
  "LOT-342": [6.596006, 3.381069],
  "LOT-343": [6.601938, 3.384088],
  "LOT-344": [6.57532, 3.383823],
  "LOT-345": [6.585551, 3.37416],
  "LOT-346": [6.52654, 3.371519],
  "LOT-347": [6.526057, 3.382483],
  "LOT-348": [6.546292, 3.377917],
  "LOT-349": [6.550093, 3.375777],
  "LOT-350": [6.531436, 3.391963],
  "LOT-351": [6.530836, 3.37463],
  "LOT-352": [6.570553, 3.378164],
  "LOT-353": [6.552635, 3.384225],
  "LOT-354": [6.56742, 3.384174],
  "LOT-355": [6.472146, 3.333852],
  "LOT-356": [6.506212, 3.369429],
  "LOT-357": [6.483315, 3.328981],
  "LOT-358": [6.497867, 3.363583],
  "LOT-359": [6.49474, 3.324698],
  "LOT-360": [6.482193, 3.356059],
  "LOT-361": [6.502094, 3.359835],
  "LOT-362": [6.503907, 3.348358],
  "LOT-363": [6.478013, 3.339841],
  "LOT-364": [6.494907, 3.351677],
  "LOT-365": [6.496948, 3.346798],
  "LOT-366": [6.493141, 3.333686],
  "LOT-367": [6.502495, 3.3345],
  "LOT-368": [6.502789, 3.352115],
  "LOT-369": [6.491015, 3.333079],
  "LOT-370": [6.479425, 3.344843],
  "LOT-371": [6.503914, 3.348963],
  "LOT-372": [6.504889, 3.343983],
  "LOT-373": [6.479901, 3.339499],
  "LOT-374": [6.482739, 3.334558],
  "LOT-375": [6.512282, 3.359632],
  "LOT-376": [6.514178, 3.349887],
  "LOT-377": [6.499268, 3.333191],
  "LOT-414": [7.35459, 3.883162],
};

/** Get the geographic center [lat, lon] for a given lotCode (e.g. "LOT-6"). */
export function getLotCenter(lotCode: string): [number, number] | null {
  return LOT_CENTERS[lotCode] ?? null;
}


// ─── Write-back types ─────────────────────────────────────────────────────────

/**
 * Parameters for updating a building polygon after a unit is registered.
 * Only aggregate/status fields are written — no individual customer PII.
 */
export interface PolygonUpdateParams {
  /** ArcGIS building_id of the parent polygon (arcgisBuildingId in MongoDB) */
  arcgisBuildingId: string;
  /** Full name of the enumerator who registered the unit */
  validatedBy: string;
  /** ISO date string of the registration (defaults to now) */
  validationDate?: string;
  /** Unit code registered e.g. R1, R2, C1, C2 — stored in flat_no */
  unitCode?: string;
  /** Building type / property type — stored in house_name */
  buildingType?: string;
}

/**
 * Parameters for creating / updating a customer point in the Customer Layer.
 * One point per unit (identified by arcgisBuildingId + unitCode combination).
 */
export interface CustomerPointParams {
  /** ArcGIS building_id of the parent polygon */
  arcgisBuildingId: string;
  /** Unit code e.g. R1, R2, C1, C2 — stored in flat_no */
  unitCode: string;
  /** GPS latitude of the unit (building centroid or surveyor GPS) */
  lat: number;
  /** GPS longitude of the unit */
  lon: number;
  /** Customer first name */
  firstName?: string;
  /** Customer last name */
  lastName?: string;
  /** Business / organisation name */
  businessName?: string;
  /** Customer phone number */
  phone?: string;
  /** Customer email */
  email?: string;
  /** Customer type: Residential | Commercial | Industrial | Mixed-Use */
  customerType?: string;
  /** Street address */
  address?: string;
  /** Enumerator full name (stored in Source field) */
  enumeratorName?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * POST a query or edit to any ArcGIS FeatureServer endpoint.
 * Uses application/x-www-form-urlencoded to avoid long-URL truncation.
 */
async function postArcGIS(
  url: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<any> {
  const body = new URLSearchParams({ ...params, token: ARCGIS_API_KEY, f: 'json' });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body, // Pass URLSearchParams directly — Capacitor native bridge handles it correctly
    signal,
  });

  if (!response.ok) {
    throw new Error(`ArcGIS HTTP ${response.status} for ${url}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`ArcGIS API error: ${data.error.message} (code ${data.error.code})`);
  }

  return data;
}

/**
 * Internal helper: POST a spatial query to the ArcGIS Feature Service.
 * Uses application/x-www-form-urlencoded body to avoid long-URL truncation.
 */
async function postArcGISQuery(
  params: Record<string, string>,
  signal: AbortSignal
): Promise<ArcGISQueryResponse> {
  const body = new URLSearchParams(params);
  const response = await fetch(`${ARCGIS_BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body, // Pass URLSearchParams directly — Capacitor native bridge handles it correctly
    signal,
  });

  if (!response.ok) {
    throw new Error(`ArcGIS API request failed: ${response.status}`);
  }

  const data: ArcGISQueryResponse = await response.json();

  if (data.error) {
    throw new Error(`ArcGIS API Error: ${data.error.message}`);
  }

  return data;
}

// ─── Write-back: Polygon update ───────────────────────────────────────────────

/**
 * Update the parent building polygon in ArcGIS after a unit is registered.
 *
 * Sets aggregate / status fields only — no individual customer PII is stored
 * on the polygon. The polygon represents the building, not the customer.
 *
 * Fields written:
 *   Verification → "Enumerated"
 *   Source       → enumerator full name
 *   flat_no      → unit code (R1 / R2 / C1 / C2)
 *   house_name   → building type (Residential / Commercial / etc.)
 *   Description  → "Validated"
 *
 * NOTE: The new Nigeria_Building_Footprints layer renamed Validation→Verification
 * and Validated_By→Source. V_Date and Zone fields no longer exist.
 *
 * Returns true on success, false on failure (non-throwing for resilience).
 */
export async function updatePolygonAfterRegistration(
  params: PolygonUpdateParams
): Promise<boolean> {
  const { arcgisBuildingId, validatedBy, unitCode, buildingType } = params;

  if (!arcgisBuildingId) {
    console.warn('[ArcGIS] updatePolygonAfterRegistration: no arcgisBuildingId — skipping');
    return false;
  }

  try {
    // Step 1: find the OBJECTID of the polygon
    const queryData = await postArcGIS(`${ARCGIS_POLYGON_URL}/query`, {
      where: `building_id='${arcgisBuildingId.replace(/'/g, "''")}'`,
      outFields: 'OBJECTID',
      returnGeometry: 'false',
      resultRecordCount: '1',
    });

    const features: any[] = queryData.features ?? [];
    if (features.length === 0) {
      console.warn(`[ArcGIS] updatePolygonAfterRegistration: polygon not found for building_id='${arcgisBuildingId}'`);
      return false;
    }

    const objectId = features[0].attributes.OBJECTID;
    // Step 2: build the update attributes
    // NOTE: V_Date field was removed in the new Nigeria_Building_Footprints layer
    const updateAttributes: Record<string, any> = {
      OBJECTID: objectId,
      Verification: 'Enumerated',
      Source: validatedBy || 'Property Enumeration App',
      Description: 'Validated',
    };

    if (unitCode) updateAttributes.flat_no = unitCode;
    if (buildingType) updateAttributes.house_name = buildingType;

    const updateFeature = { attributes: updateAttributes };

    // Step 3: applyEdits / updateFeatures
    const updateData = await postArcGIS(`${ARCGIS_POLYGON_URL}/updateFeatures`, {
      features: JSON.stringify([updateFeature]),
      rollbackOnFailure: 'true',
    });

    const updateResults: any[] = updateData.updateResults ?? [];
    const success = updateResults.length > 0 && (updateResults[0].success === true);

    if (success) {
      console.log(`[ArcGIS] Polygon updated for building_id='${arcgisBuildingId}' (OBJECTID=${objectId})`);
    } else {
      const err = updateResults[0]?.error;
      console.error(`[ArcGIS] Polygon update failed for '${arcgisBuildingId}':`, err);
    }

    return success;
  } catch (error) {
    console.error('[ArcGIS] updatePolygonAfterRegistration error:', error);
    return false;
  }
}

// ─── Write-back: Customer point upsert ───────────────────────────────────────

/**
 * Create or update a customer point in the ArcGIS Customer Layer.
 *
 * Each point represents one unit (R1, R2, C1, C2) within a building polygon.
 * The lookup key is building_id + flat_no (unit code) — if a record already
 * exists for that combination it is updated in-place; otherwise a new point
 * is added.
 *
 * This ensures one point per unit, not one point per polygon or per customer.
 *
 * Returns true on success, false on failure (non-throwing for resilience).
 */
export async function upsertCustomerPoint(
  params: CustomerPointParams
): Promise<boolean> {
  const {
    arcgisBuildingId,
    unitCode,
    lat,
    lon,
    firstName,
    lastName,
    businessName,
    phone,
    email,
    customerType,
    address,
    enumeratorName,
  } = params;

  if (!arcgisBuildingId || !unitCode) {
    console.warn('[ArcGIS] upsertCustomerPoint: missing arcgisBuildingId or unitCode — skipping');
    return false;
  }

  const escapedBuildingId = arcgisBuildingId.replace(/'/g, "''");
  const escapedUnitCode = unitCode.replace(/'/g, "''");

  const geometry = {
    x: lon,
    y: lat,
    spatialReference: { wkid: 4326 },
  };

  const attributes: Record<string, any> = {
    building_id: arcgisBuildingId,
    flat_no: unitCode,
    Lat: lat,
    Long: lon,
  };

  if (firstName) attributes.first_name = firstName;
  if (lastName) attributes.last_name = lastName;
  if (businessName) attributes.business_name = businessName;
  if (phone) attributes.cust_phone = phone;
  if (email) attributes.customer_email = email;
  if (customerType) attributes.customer_type = customerType;
  if (address) attributes.address = address;
  if (enumeratorName) attributes.Source = enumeratorName;

  try {
    // Step 1: check for an existing record with this building_id + flat_no
    const queryData = await postArcGIS(`${ARCGIS_CUSTOMER_URL}/query`, {
      where: `building_id='${escapedBuildingId}' AND flat_no='${escapedUnitCode}'`,
      outFields: 'OBJECTID',
      returnGeometry: 'false',
      resultRecordCount: '1',
    });

    const features: any[] = queryData.features ?? [];

    if (features.length > 0) {
      // Step 2a: UPDATE existing record
      const objectId = features[0].attributes.OBJECTID;
      const updateFeature = {
        geometry,
        attributes: { OBJECTID: objectId, ...attributes },
      };

      const updateData = await postArcGIS(`${ARCGIS_CUSTOMER_URL}/updateFeatures`, {
        features: JSON.stringify([updateFeature]),
        rollbackOnFailure: 'true',
      });

      const updateResults: any[] = updateData.updateResults ?? [];
      const success = updateResults.length > 0 && (updateResults[0].success === true);

      if (success) {
        console.log(`[ArcGIS] Customer point updated for building_id='${arcgisBuildingId}' unit='${unitCode}' (OBJECTID=${objectId})`);
      } else {
        const err = updateResults[0]?.error;
        console.error(`[ArcGIS] Customer point update failed for '${arcgisBuildingId}' unit='${unitCode}':`, err);
      }

      return success;
    } else {
      // Step 2b: INSERT new record
      const addFeature = { geometry, attributes };

      const addData = await postArcGIS(`${ARCGIS_CUSTOMER_URL}/addFeatures`, {
        features: JSON.stringify([addFeature]),
        rollbackOnFailure: 'true',
      });

      const addResults: any[] = addData.addResults ?? [];
      const success = addResults.length > 0 && (addResults[0].success === true);

      if (success) {
        console.log(`[ArcGIS] Customer point added for building_id='${arcgisBuildingId}' unit='${unitCode}' (OBJECTID=${addResults[0].objectId})`);
      } else {
        const err = addResults[0]?.error;
        console.error(`[ArcGIS] Customer point add failed for '${arcgisBuildingId}' unit='${unitCode}':`, err);
      }

      return success;
    }
  } catch (error) {
    console.error('[ArcGIS] upsertCustomerPoint error:', error);
    return false;
  }
}

// ─── Customer Layer read (v1.59.0) ──────────────────────────────────────────────

/**
 * A single customer point record from the ArcGIS Customer Layer.
 * Used to enrich building polygon labels with live customer data.
 */
export interface CustomerPoint {
  buildingId: string;
  unitCode?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  customerType?: string;
  address?: string;
  lat?: number;
  lon?: number;
}

/**
 * Fetch all customer points within a bounding box from the Customer Layer.
 * Returns a map keyed by building_id for O(1) lookup when enriching polygons.
 *
 * Only fetches the label-relevant fields (building_id, first_name, last_name,
 * business_name) to keep the payload small. Uses POST to avoid URL truncation.
 *
 * IMPORTANT: The Customer Layer geometry is stored in Web Mercator (EPSG:3857)
 * but the app works in WGS84. We must pass inSR=4326 so ArcGIS correctly
 * interprets the bounding box coordinates as WGS84 degrees.
 *
 * Returns an empty map on any error (non-throwing for resilience).
 */
export async function fetchCustomerPointsInBounds(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<Map<string, CustomerPoint[]>> {
  // One-to-many: map keyed by buildingId → array of all customer units
  const result = new Map<string, CustomerPoint[]>();
  try {
    const params: Record<string, string> = {
      where: '1=1',
      geometry: JSON.stringify({
        xmin: bounds.west,
        ymin: bounds.south,
        xmax: bounds.east,
        ymax: bounds.north,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: '4326',
      outFields: 'building_id,first_name,last_name,business_name,cust_phone,customer_email,customer_type,address,flat_no,Lat,Long',
      returnGeometry: 'false',
      resultRecordCount: '4000',
      f: 'json',
      token: ARCGIS_API_KEY,
    };

    const body = new URLSearchParams(params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${ARCGIS_CUSTOMER_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body, // Pass URLSearchParams directly — Capacitor native bridge handles it correctly
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const features: any[] = data.features ?? [];
    console.log(`[CustomerLayer] Fetched ${features.length} customer points in viewport`);

    for (const f of features) {
      const a = f.attributes;
      const buildingId: string = a.building_id ?? '';
      if (!buildingId) continue;
      const cp: CustomerPoint = {
        buildingId,
        unitCode: a.flat_no ?? undefined,
        firstName: a.first_name ?? undefined,
        lastName: a.last_name ?? undefined,
        businessName: a.business_name ?? undefined,
        phone: a.cust_phone ?? undefined,
        email: a.customer_email ?? undefined,
        customerType: a.customer_type ?? undefined,
        address: a.address ?? undefined,
        lat: a.Lat ?? undefined,
        lon: a.Long ?? undefined,
      };
      // One-to-many: collect ALL customer units per building
      const existing = result.get(buildingId) ?? [];
      // Avoid exact duplicate unit codes
      const isDuplicate = cp.unitCode !== undefined && existing.some(e => e.unitCode === cp.unitCode);
      if (!isDuplicate) {
        // Named records go first so the most informative entry is at index 0
        const hasName = !!(cp.businessName || cp.firstName || cp.lastName);
        result.set(buildingId, hasName ? [cp, ...existing] : [...existing, cp]);
      }
    }
  } catch (error) {
    console.warn('[CustomerLayer] fetchCustomerPointsInBounds failed (non-critical):', error);
  }
  return result;
}

/**
 * Fetch all customer points for a specific lot by matching the building_id
 * suffix pattern (e.g. all building_ids ending in 'LASKSE05 242').
 *
 * This is the fallback for lots where customer points have null Lat/Long
 * coordinates (e.g. LOT-242 Anthony, Kosofe) and cannot be found via
 * spatial queries. Uses the building_id field directly.
 *
 * Returns a map keyed by building_id for O(1) lookup.
 * Returns an empty map on any error (non-throwing for resilience).
 */
export async function fetchCustomerPointsForLot(
  lotBuildingIdSuffix: string
): Promise<Map<string, CustomerPoint[]>> {
  // One-to-many: map keyed by buildingId → array of all customer units
  const result = new Map<string, CustomerPoint[]>();
  if (!lotBuildingIdSuffix) return result;

  try {
    const escaped = lotBuildingIdSuffix.replace(/'/g, "''");
    const params: Record<string, string> = {
      where: `building_id LIKE '%${escaped}'`,
      outFields: 'building_id,first_name,last_name,business_name,cust_phone,customer_email,customer_type,address,flat_no,Lat,Long',
      returnGeometry: 'false',
      resultRecordCount: '10000',
      f: 'json',
      token: ARCGIS_API_KEY,
    };

    const body = new URLSearchParams(params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${ARCGIS_CUSTOMER_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body, // Pass URLSearchParams directly — Capacitor native bridge handles it correctly
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const features: any[] = data.features ?? [];
    console.log(`[CustomerLayer] fetchCustomerPointsForLot('${lotBuildingIdSuffix}'): ${features.length} records`);

    for (const f of features) {
      const a = f.attributes;
      const buildingId: string = a.building_id ?? '';
      if (!buildingId) continue;
      const cp: CustomerPoint = {
        buildingId,
        unitCode: a.flat_no ?? undefined,
        firstName: a.first_name ?? undefined,
        lastName: a.last_name ?? undefined,
        businessName: a.business_name ?? undefined,
        phone: a.cust_phone ?? undefined,
        email: a.customer_email ?? undefined,
        customerType: a.customer_type ?? undefined,
        address: a.address ?? undefined,
        lat: a.Lat ?? undefined,
        lon: a.Long ?? undefined,
      };
      // One-to-many: collect ALL customer units per building
      const existing = result.get(buildingId) ?? [];
      // Avoid exact duplicate unit codes
      const isDuplicate = cp.unitCode !== undefined && existing.some(e => e.unitCode === cp.unitCode);
      if (!isDuplicate) {
        // Named records go first so the most informative entry is at index 0
        const hasName = !!(cp.businessName || cp.firstName || cp.lastName);
        result.set(buildingId, hasName ? [cp, ...existing] : [...existing, cp]);
      }
    }
  } catch (error) {
    console.warn(`[CustomerLayer] fetchCustomerPointsForLot failed (non-critical):`, error);
  }
  return result;
}

// ─── Two-phase progressive loader (v1.59.2) ─────────────────────────────────

/**
 * Convert a MongoDB lotCode (e.g. "LOT-242", "MOT-027", "LOT-06") to the
 * ArcGIS Lot_ID string used in the Footprint layer.
 *
 * Rules:
 *   1. Strip any alphabetic prefix up to and including the first hyphen.
 *   2. Zero-pad the numeric part to 3 digits to match the layer's format
 *      (e.g. "LOT-6" → "006", "LOT-06" → "006", "LOT-242" → "242").
 *   3. If the input already looks like a bare number, zero-pad it to 3 digits.
 *
 * The Nigeria_Building_Footprints layer stores Lot_ID as a 3-digit zero-padded
 * string (e.g. "006", "027", "061", "242"). Without padding, queries for
 * "6" or "06" return zero results even when 8,720 features exist for "006".
 */
export function lotCodeToArcGISLotId(lotCode: string): string | null {
  if (!lotCode) return null;
  // Strip prefix like "LOT-", "MOT-", "ADK-", "AFT-", etc.
  const match = lotCode.match(/^[A-Za-z]+-?(\d+)$/);
  const digits = match ? match[1] : (/^\d+$/.test(lotCode) ? lotCode : null);
  if (!digits) return null;
  // Zero-pad to at least 3 digits (e.g. "6" → "006", "06" → "006", "242" → "242")
  return digits.padStart(3, '0');
}

/**
 * Fetch a single batch of building polygons by OBJECTID list.
 * Used internally by fetchPolygonsForLotProgressive.
 */
async function fetchPolygonsByObjectIds(
  objectIds: number[]
): Promise<BuildingPolygon[]> {
  if (objectIds.length === 0) return [];
  const params: Record<string, string> = {
    objectIds: objectIds.join(','),
    outFields:
      'building_id,address,Verification,Source,lga_name,lga_code,state_code,ward_name,ward_code,latitude,longitude,house_name,flat_no,Description,Enlistment',
    returnGeometry: 'true',
    f: 'json',
    token: ARCGIS_API_KEY,
  };
  const body = new URLSearchParams(params);
  const response = await fetch(`${ARCGIS_BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body, // Pass URLSearchParams directly — Capacitor native bridge handles it correctly
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return (data.features ?? []).map((f: ArcGISFeature) =>
    convertArcGISFeatureToBuildingPolygon(f)
  );
}

/**
 * Progressive two-phase polygon loader.
 *
 * Phase 1 (~2.5s): Fetch all OBJECTIDs for the lot using a lightweight
 *   attribute-only query filtered by Lot_ID. No geometry, no spatial index.
 *
 * Phase 2 (~2s per 400): Stream geometry in parallel batches of BATCH_SIZE.
 *   The first INITIAL_BATCHES batches are awaited before returning so the
 *   map gets its first polygons quickly. Remaining batches are dispatched
 *   in the background and delivered via the onBatch callback.
 *
 * Falls back to the legacy spatial query if lotCode cannot be mapped.
 *
 * @param lotCode    MongoDB lotCode (e.g. "LOT-242")
 * @param onBatch    Called with each subsequent batch of polygons after the
 *                   initial set has been returned. Use this to merge into
 *                   the map's polygon state progressively.
 * @returns          First INITIAL_BATCHES × BATCH_SIZE polygons (or all if
 *                   the lot is small), ready to render immediately.
 */
export async function fetchPolygonsForLotProgressive(
  lotCode: string,
  onBatch: (polygons: BuildingPolygon[]) => void
): Promise<BuildingPolygon[]> {
  const BATCH_SIZE = 50;
  const PARALLEL_WORKERS = 4;
  const INITIAL_BATCHES = 1; // First 100 polygons returned synchronously (rest stream in background)

  const lotId = lotCodeToArcGISLotId(lotCode);
  if (!lotId) {
    console.warn(`[Progressive] Cannot map lotCode '${lotCode}' to ArcGIS Lot_ID — falling back to legacy loader`);
    return [];
  }

  console.log(`[Progressive] Phase 1: fetching OBJECTIDs for Lot_ID='${lotId}'`);
  const t0 = Date.now();

  // Phase 1: Get all OBJECTIDs (fast — attribute-only, no geometry)
  const body1 = new URLSearchParams({
    where: `Lot_ID='${lotId}'`,
    returnIdsOnly: 'true',
    f: 'json',
    token: ARCGIS_API_KEY,
  });
  const res1 = await fetch(`${ARCGIS_BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body1, // Pass URLSearchParams directly — Capacitor native bridge handles it correctly
  });
  if (!res1.ok) throw new Error(`Phase 1 HTTP ${res1.status}`);
  const data1 = await res1.json();
  if (data1.error) throw new Error(data1.error.message);

  const allIds: number[] = data1.objectIds ?? [];
  console.log(`[Progressive] Phase 1 done: ${allIds.length} OBJECTIDs in ${Date.now() - t0}ms`);

  if (allIds.length === 0) return [];

  // Split into batches of BATCH_SIZE
  const batches: number[][] = [];
  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    batches.push(allIds.slice(i, i + BATCH_SIZE));
  }

  // Phase 2a: Fetch first INITIAL_BATCHES × PARALLEL_WORKERS batches in parallel (synchronous return)
  const initialBatchCount = Math.min(INITIAL_BATCHES, batches.length);
  const initialBatches = batches.slice(0, initialBatchCount);
  const remainingBatches = batches.slice(initialBatchCount);

  console.log(`[Progressive] Phase 2a: fetching first ${initialBatchCount} batches (${initialBatchCount * BATCH_SIZE} polygons) in parallel`);
  const t1 = Date.now();

  // Run initial batches in parallel groups of PARALLEL_WORKERS
  const initialPolygons: BuildingPolygon[] = [];
  for (let i = 0; i < initialBatches.length; i += PARALLEL_WORKERS) {
    const group = initialBatches.slice(i, i + PARALLEL_WORKERS);
    const results = await Promise.all(group.map(fetchPolygonsByObjectIds));
    results.forEach(r => initialPolygons.push(...r));
  }
  console.log(`[Progressive] Phase 2a done: ${initialPolygons.length} polygons in ${Date.now() - t1}ms`);

  // Phase 2b: Stream remaining batches in the background
  if (remainingBatches.length > 0) {
    console.log(`[Progressive] Phase 2b: streaming ${remainingBatches.length} remaining batches in background`);
    (async () => {
      for (let i = 0; i < remainingBatches.length; i += PARALLEL_WORKERS) {
        const group = remainingBatches.slice(i, i + PARALLEL_WORKERS);
        try {
          const results = await Promise.all(group.map(fetchPolygonsByObjectIds));
          const batch: BuildingPolygon[] = [];
          results.forEach(r => batch.push(...r));
          if (batch.length > 0) onBatch(batch);
        } catch (e) {
          console.warn('[Progressive] Background batch failed:', e);
        }
      }
      console.log('[Progressive] Phase 2b complete — all batches delivered');
    })();
  }

  return initialPolygons;
}

// ─── Read-only queries (unchanged from v1.58.2) ───────────────────────────────

/**
 * Fetch building polygons within a bounding box (viewport)
 * @param bounds - Map bounds { north, south, east, west }
 * @returns Array of BuildingPolygon objects or empty array on error
 */
export async function fetchPolygonsInBounds(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<BuildingPolygon[]> {
  try {
    // ✅ POST with form body — avoids long-URL truncation in the field
    const params: Record<string, string> = {
      where: '1=1',
      geometry: JSON.stringify({
        xmin: bounds.west,
        ymin: bounds.south,
        xmax: bounds.east,
        ymax: bounds.north,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      outFields:
        'building_id,address,Verification,Source,lga_name,lga_code,state_code,ward_name,ward_code,latitude,longitude,house_name,flat_no,Description,Enlistment',
      returnGeometry: 'true',
      f: 'json',
      token: ARCGIS_API_KEY,
    };

    console.log('[ArcGIS] Fetching polygons in bounds (POST):', bounds);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const data = await postArcGISQuery(params, controller.signal);
      clearTimeout(timeoutId);

      console.log(`[ArcGIS] Fetched ${data.features.length} polygons in viewport`);
      return data.features.map((feature) => convertArcGISFeatureToBuildingPolygon(feature));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[ArcGIS] Request timeout after', REQUEST_TIMEOUT, 'ms');
        throw new Error('Request timeout - ArcGIS service is slow or unavailable');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[ArcGIS] Error fetching polygons in bounds:', error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Fetch building polygons within radius from a center point
 * @param lat - Center latitude (WGS84)
 * @param lon - Center longitude (WGS84)
 * @param radiusKm - Search radius in kilometers (default 5km)
 * @returns Array of BuildingPolygon objects or empty array on error
 */
export async function fetchPolygonsNearLocation(
  lat: number,
  lon: number,
  radiusKm: number = 5
): Promise<BuildingPolygon[]> {
  try {
    const radiusMeters = radiusKm * 1000;

    // ✅ POST with form body — avoids long-URL truncation in the field
    const params: Record<string, string> = {
      where: '1=1',
      geometry: JSON.stringify({
        x: lon,
        y: lat,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      distance: radiusMeters.toString(),
      units: 'esriSRUnit_Meter',
      outFields:
        'building_id,address,Verification,Source,lga_name,lga_code,state_code,ward_name,ward_code,latitude,longitude,house_name,flat_no,Description,Enlistment',
      returnGeometry: 'true',
      f: 'json',
      token: ARCGIS_API_KEY,
    };

    console.log('[ArcGIS] Fetching polygons near (POST):', { lat, lon, radiusKm });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const data = await postArcGISQuery(params, controller.signal);
      clearTimeout(timeoutId);

      // Comprehensive logging for debugging
      console.log('[ArcGIS] Features count:', data.features?.length || 0);

      if (!data.features || data.features.length === 0) {
        console.warn('[ArcGIS] No features returned from API');
        return [];
      }

      console.log(`[ArcGIS] Fetched ${data.features.length} polygons`);
      console.log('[ArcGIS] First feature sample:', JSON.stringify(data.features[0], null, 2));

      // Convert ArcGIS features to BuildingPolygon objects
      const polygons = data.features.map((feature) => {
        const converted = convertArcGISFeatureToBuildingPolygon(feature);
        console.log('[ArcGIS] Converted polygon:', {
          buildingId: converted.buildingId,
          center: [converted.centerLat, converted.centerLon],
          geometryType: converted.geometry.type,
          coordinatesLength: converted.geometry.coordinates.length,
        });
        return converted;
      });

      return polygons;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[ArcGIS] Request timeout after', REQUEST_TIMEOUT, 'ms');
        throw new Error('Request timeout - ArcGIS service is slow or unavailable');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[ArcGIS] Error fetching polygons:', error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Fetch a single building polygon by building ID
 * @param buildingId - Building ID to fetch
 * @returns BuildingPolygon or null if not found
 */
export async function fetchPolygonByBuildingId(
  buildingId: string
): Promise<BuildingPolygon | null> {
  try {
    // Short URL — GET is fine here (building ID string is not long)
    const params = new URLSearchParams({
      where: `building_id='${buildingId}'`,
      outFields:
        'building_id,address,Verification,Source,lga_name,lga_code,state_code,ward_name,ward_code,latitude,longitude,house_name,flat_no,Description,Enlistment',
      returnGeometry: 'true',
      f: 'json',
      token: ARCGIS_API_KEY,
    });

    const url = `${ARCGIS_BASE_URL}/query?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ArcGIS API request failed: ${response.status}`);
      }

      const data: ArcGISQueryResponse = await response.json();

      if (data.error) {
        throw new Error(`ArcGIS API Error: ${data.error.message}`);
      }

      if (data.features.length === 0) {
        return null;
      }

      return convertArcGISFeatureToBuildingPolygon(data.features[0]);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('[ArcGIS] Error fetching polygon by ID:', error);
    return null;
  }
}

/**
 * Test connection to ArcGIS service
 * @returns true if connection successful, false otherwise
 */
export async function testArcGISConnection(): Promise<boolean> {
  try {
    // Short metadata URL — GET is fine here
    const url = `${ARCGIS_BASE_URL}?f=json&token=${ARCGIS_API_KEY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      return false;
    }
  } catch (error) {
    console.error('[ArcGIS] Connection test failed:', error);
    return false;
  }
}

/**
 * Convert ArcGIS feature to BuildingPolygon
 * @param feature - ArcGIS feature
 * @returns BuildingPolygon object
 */
function convertArcGISFeatureToBuildingPolygon(feature: ArcGISFeature): BuildingPolygon {
  const { attributes, geometry } = feature;

  // Nigeria_Building_Footprints layer stores rings in WGS84 (EPSG:4326) natively.
  // NO coordinate conversion needed — use rings directly as GeoJSON [lon, lat] pairs.
  const wgs84Rings = geometry.rings;

  // Calculate center point from WGS84 rings
  const { centerLat, centerLon } = calculatePolygonCenter(wgs84Rings);

  // Create GeoJSON polygon
  const geoJsonPolygon: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: wgs84Rings,
  };

  return {
    buildingId: attributes.building_id || '',
    // Customer data lives exclusively in the Customer Point layer.
    // These fields are intentionally NOT read from the polygon layer.
    businessName: undefined,
    firstName: undefined,
    lastName: undefined,
    custPhone: undefined,
    customerEmail: undefined,
    address: attributes.address,
    zone: undefined,
    socioEconomicGroups: undefined,
    // Enumeration status fields (written back after registration)
    // New layer uses Verification (was Validation) and Source (was Validated_By)
    validation: attributes.Verification,
    validatedBy: attributes.Source,
    flatNo: attributes.flat_no,
    description: attributes.Description,
    enlistment: attributes.Enlistment,
    // Administrative geo fields from footprint layer
    lgaName: attributes.lga_name,
    lgaCode: attributes.lga_code,
    stateCode: attributes.state_code,
    wardName: attributes.ward_name,
    wardCode: attributes.ward_code,
    footprintLat: attributes.latitude,
    footprintLon: attributes.longitude,
    geometry: geoJsonPolygon,
    centerLat,
    centerLon,
    lastUpdated: new Date(),
  };
}
