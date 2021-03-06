odoo.define('tzc_sale.website_catalog', function (require) {
    "use strict";

    require('web.dom_ready');
    var base = require("web_editor.base");
    var ajax = require('web.ajax');
    var utils = require('web.utils');
    var core = require('web.core');
    var config = require('web.config');
    require("website.content.zoomodoo");
    var _t = core._t;

    if(!$('.oe_website_sale').length) {
        return $.Deferred().reject("DOM doesn't contain '.oe_website_sale'");
    }

    $('.oe_website_sale').each(function () {
        var oe_website_sale = this;

        var clickwatch = (function(){
              var timer = 0;
              return function(callback, ms){
                clearTimeout(timer);
                timer = setTimeout(callback, ms);
              };
        })();

        $(oe_website_sale).on("change", ".oe_catalog input.js_quantity[data-product-id]", function () {
          var $input = $(this);
            if ($input.data('update_change')) {
                return;
            }
          var value = parseInt($input.val() || 0, 10);
          if (isNaN(value)) {
              value = 1;
          }
          var $dom = $(this).closest('tr');
          //var default_price = parseFloat($dom.find('.text-danger > span.oe_currency_value').text());
          var $dom_optional = $dom.nextUntil(':not(.optional_product.info)');
          var line_id = parseInt($input.data('line-id'),10);
          var product_ids = [parseInt($input.data('product-id'),10)];

//          console.log('==============================================================================');
//          console.log(line_id);

          clickwatch(function(){
            $dom_optional.each(function(){
                $(this).find('.js_quantity').text(value);
                product_ids.push($(this).find('span[data-product-id]').data('product-id'));
            });
            $input.data('update_change', true);

            ajax.jsonRpc("/shop/catalog/update_json", 'call', {
                'line_id': line_id,
                'product_id': parseInt($input.data('product-id'), 10),
                'set_qty': value
            }).then(function (data) {
                $input.data('update_change', false);
                var check_value = parseInt($input.val() || 0, 10);
                if (isNaN(check_value)) {
                    check_value = 1;
                }
                if (value !== check_value) {
                    $input.trigger('change');
                    return;
                }
                var $q = $(".my_catalog_quantity");
                if (data.catalog_quantity) {
                    $q.parents('li:first').removeClass("hidden");
                }
                else {
                    $q.parents('li:first').addClass("hidden");
                    $('a[href*="/shop/checkout"]').addClass("hidden");
                }

                $q.html(data.catalog_quantity).hide().fadeIn(600);
                $input.val(data.quantity);
                $('.js_quantity[data-line-id='+line_id+']').val(data.quantity).html(data.quantity);

                $(".js_catalog_lines").first().before(data['tzc_sale.catalog_lines']).end().remove();

                if (data.warning) {
                    var catalog_alert = $('.oe_catalog').parent().find('#data_warning');
                    if (catalog_alert.length === 0) {
                        $('.oe_catalog').prepend('<div class="alert alert-danger alert-dismissable" role="alert" id="data_warning">'+
                                '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button> ' + data.warning + '</div>');
                    }
                    else {
                        catalog_alert.html('<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button> ' + data.warning);
                    }
                    $input.val(data.quantity);
                }
            });
          }, 500);
        });

        $(oe_website_sale).on("click", ".oe_catalog a.js_add_suggested_products", function () {
            $(this).prev('input').val(1).trigger('change');
        });

        // hack to add and remove from catalog with json
        $(oe_website_sale).on('click', 'a.js_add_catalog_json', function (ev) {
            ev.preventDefault();
            var $link = $(ev.currentTarget);
            var $input = $link.parent().find("input");
            var product_id = +$input.closest('*:has(input[name="product_id"])').find('input[name="product_id"]').val();
            var min = parseFloat($input.data("min") || 0);
            var max = parseFloat($input.data("max") || Infinity);
            var quantity = ($link.has(".fa-minus").length ? -1 : 1) + parseFloat($input.val() || 0, 10);
            var new_qty = quantity > min ? (quantity < max ? quantity : max) : min;
            // if they are more of one input for this product (eg: option modal)
            $('input[name="'+$input.attr("name")+'"]').add($input).filter(function () {
                var $prod = $(this).closest('*:has(input[name="product_id"])');
                return !$prod.length || +$prod.find('input[name="product_id"]').val() === product_id;
            }).val(new_qty).change();
            return false;
        });

        $('.oe_website_sale, #comment').off('click', '.a-submit').on('click', '.a-submit', function (event) {
            if (!event.isDefaultPrevented() && !$(this).is(".disabled")) {
                event.preventDefault();
                $(this).closest('form').submit();
            }
            if ($(this).hasClass('a-submit-disable')){
                $(this).addClass("disabled");
            }
            if ($(this).hasClass('a-submit-loading')){
                var loading = '<span class="fa fa-cog fa-spin"/>';
                var fa_span = $(this).find('span[class*="fa"]');
                if (fa_span.length){
                    fa_span.replaceWith(loading);
                }
                else{
                    $(this).append(loading);
                }
            }
        });
        $('form.js_attributes input, form.js_attributes select', oe_website_sale).on('change', function (event) {
            if (!event.isDefaultPrevented()) {
                event.preventDefault();
                $(this).closest("form").submit();
            }
        });

        // change price when they are variants
        $('form.js_add_catalog_json label', oe_website_sale).on('mouseup touchend', function () {
            var $label = $(this);
            var $price = $label.parents("form:first").find(".oe_price .oe_currency_value");
            if (!$price.data("price")) {
                $price.data("price", parseFloat($price.text()));
            }
            var value = $price.data("price") + parseFloat($label.find(".badge span").text() || 0);

            var dec = value % 1;
            $price.html(value + (dec < 0.01 ? ".00" : (dec < 1 ? "0" : "") ));
        });
        // hightlight selected color
        $('.css_attribute_color input', oe_website_sale).on('change', function () {
            $('.css_attribute_color').removeClass("active");
            $('.css_attribute_color:has(input:checked)').addClass("active");
        });

        function price_to_str(price) {
            var l10n = _t.database.parameters;
            var precision = 2;

            if ($(".decimal_precision").length) {
                precision = parseInt($(".decimal_precision").last().data('precision'));
            }
            var formatted = _.str.sprintf('%.' + precision + 'f', price).split('.');
            formatted[0] = utils.insert_thousand_seps(formatted[0]);
            return formatted.join(l10n.decimal_point);
        }

        function update_product_image(event_source, product_id) {
            var $img;
            if ($('#o-carousel-product').length) {
                $img = $(event_source).closest('tr.js_product, .oe_website_sale').find('img.js_variant_img');
                $img.attr("src", "/web/image/product.product/" + product_id + "/image");
                $img.parent().attr('data-oe-model', 'product.product').attr('data-oe-id', product_id)
                    .data('oe-model', 'product.product').data('oe-id', product_id);

                var $thumbnail = $(event_source).closest('tr.js_product, .oe_website_sale').find('img.js_variant_img_small');
                if ($thumbnail.length !== 0) { // if only one, thumbnails are not displayed
                    $thumbnail.attr("src", "/web/image/product.product/" + product_id + "/image/90x90");
                    $('.carousel').carousel(0);
                }
            }
            else {
                $img = $(event_source).closest('tr.js_product, .oe_website_sale').find('span[data-oe-model^="product."][data-oe-type="image"] img:first, img.product_detail_img');
                $img.attr("src", "/web/image/product.product/" + product_id + "/image");
                $img.parent().attr('data-oe-model', 'product.product').attr('data-oe-id', product_id)
                    .data('oe-model', 'product.product').data('oe-id', product_id);
            }
            // reset zooming constructs
            $img.filter('[data-zoom-image]').attr('data-zoom-image', $img.attr('src'));
            if ($img.data('zoomOdoo') !== undefined) {
                $img.data('zoomOdoo').isReady = false;
            }
        }

        $(oe_website_sale).on('change', 'input.js_product_change', function () {
            var self = this;
            var $parent = $(this).closest('.js_product');
            $.when(base.ready()).then(function() {
                $parent.find(".oe_default_price:first .oe_currency_value").html( price_to_str(+$(self).data('lst_price')) );
                $parent.find(".oe_price:first .oe_currency_value").html(price_to_str(+$(self).data('price')) );
            });
            update_product_image(this, +$(this).val());
        });

        $(oe_website_sale).on('change', 'input.js_variant_change, select.js_variant_change, ul[data-attribute_value_ids]', function (ev) {
            var $ul = $(ev.target).closest('.js_add_catalog_variants');
            var $parent = $ul.closest('.js_product');
            var $product_id = $parent.find('.product_id').first();
            var $price = $parent.find(".oe_price:first .oe_currency_value");
            var $default_price = $parent.find(".oe_default_price:first .oe_currency_value");
            var $optional_price = $parent.find(".oe_optional:first .oe_currency_value");
            var variant_ids = $ul.data("attribute_value_ids");
            if(_.isString(variant_ids)) {
                variant_ids = JSON.parse(variant_ids.replace(/'/g, '"'));
            }
            var values = [];
            var unchanged_values = $parent.find('div.oe_unchanged_value_ids').data('unchanged_value_ids') || [];

            $parent.find('input.js_variant_change:checked, select.js_variant_change').each(function () {
                values.push(+$(this).val());
            });
            values =  values.concat(unchanged_values);

            $parent.find("label").removeClass("text-muted css_not_available");

            var product_id = false;
            for (var k in variant_ids) {
                if (_.isEmpty(_.difference(variant_ids[k][1], values))) {
                    $.when(base.ready()).then(function() {
                        $price.html(price_to_str(variant_ids[k][2]));
                        $default_price.html(price_to_str(variant_ids[k][3]));
                    });
                    if (variant_ids[k][3]-variant_ids[k][2]>0.01) {
                        $default_price.closest('.oe_website_sale').addClass("discount");
                        $optional_price.closest('.oe_optional').show().css('text-decoration', 'line-through');
                        $default_price.parent().removeClass('hidden');
                    } else {
                        $optional_price.closest('.oe_optional').hide();
                        $default_price.parent().addClass('hidden');
                    }
                    product_id = variant_ids[k][0];
                    update_product_image(this, product_id);
                    break;
                }
            }

            $parent.find("input.js_variant_change:radio, select.js_variant_change").each(function () {
                var $input = $(this);
                var id = +$input.val();
                var values = [id];

                $parent.find("ul:not(:has(input.js_variant_change[value='" + id + "'])) input.js_variant_change:checked, select.js_variant_change").each(function () {
                    values.push(+$(this).val());
                });

                for (var k in variant_ids) {
                    if (!_.difference(values, variant_ids[k][1]).length) {
                        return;
                    }
                }
                $input.closest("label").addClass("css_not_available");
                $input.find("option[value='" + id + "']").addClass("css_not_available");
            });

            if (product_id) {
                $parent.removeClass("css_not_available");
                $product_id.val(product_id);
                $parent.find("#add_to_catalog").removeClass("disabled");
            } else {
                $parent.addClass("css_not_available");
                $product_id.val(0);
                $parent.find("#add_to_catalog").addClass("disabled");
            }
        });

        $('div.js_product', oe_website_sale).each(function () {
            $('input.js_product_change', this).first().prop('checked', 'checked').trigger('change');
        });

        $('.js_add_catalog_variants', oe_website_sale).each(function () {
            $('input.js_variant_change, select.js_variant_change', this).first().trigger('change');
        });

        $('.oe_catalog').on('click', '.js_change_shipping', function() {
          if (!$('body.editor_enable').length) { //allow to edit button text with editor
            var $old = $('.all_shipping').find('.panel.border_primary');
            $old.find('.btn-ship').toggle();
            $old.addClass('js_change_shipping');
            $old.removeClass('border_primary');

            var $new = $(this).parent('div.one_kanban').find('.panel');
            $new.find('.btn-ship').toggle();
            $new.removeClass('js_change_shipping');
            $new.addClass('border_primary');

            var $form = $(this).parent('div.one_kanban').find('form.hide');
            $.post($form.attr('action'), $form.serialize()+'&xhr=1');
          }
        });
        $('.oe_catalog').on('click', '.js_edit_address', function() {
            $(this).parent('div.one_kanban').find('form.hide').attr('action', '/shop/address').submit();
        });
        $('.oe_catalog').on('click', '.js_delete_product', function(e) {
            e.preventDefault();
            $(this).closest('tr').find('.js_quantity').val(0).trigger('change');
        });

        if ($('.oe_website_sale .dropdown_sorty_by').length) {
            // this method allow to keep current get param from the action, with new search query
            $('.oe_website_sale .o_website_sale_search').on('submit', function (event) {
                var $this = $(this);
                if (!event.isDefaultPrevented() && !$this.is(".disabled")) {
                    event.preventDefault();
                    var oldurl = $this.attr('action');
                    oldurl += (oldurl.indexOf("?")===-1) ? "?" : "";
                    var search = $this.find('input.search-query');
                    window.location = oldurl + '&' + search.attr('name') + '=' + encodeURIComponent(search.val());
                }
            });
        }

        if ($(".checkout_autoformat").length) {
            $(oe_website_sale).on('change', "select[name='country_id']", function () {
                clickwatch(function() {
                    if ($("#country_id").val()) {
                        ajax.jsonRpc("/shop/country_infos/" + $("#country_id").val(), 'call', {mode: 'shipping'}).then(
                            function(data) {
                                // placeholder phone_code
                                //$("input[name='phone']").attr('placeholder', data.phone_code !== 0 ? '+'+ data.phone_code : '');

                                // populate states and display
                                var selectStates = $("select[name='state_id']");
                                // dont reload state at first loading (done in qweb)
                                if (selectStates.data('init')===0 || selectStates.find('option').length===1) {
                                    if (data.states.length) {
                                        selectStates.html('');
                                        _.each(data.states, function(x) {
                                            var opt = $('<option>').text(x[1])
                                                .attr('value', x[0])
                                                .attr('data-code', x[2]);
                                            selectStates.append(opt);
                                        });
                                        selectStates.parent('div').show();
                                    }
                                    else {
                                        selectStates.val('').parent('div').hide();
                                    }
                                    selectStates.data('init', 0);
                                }
                                else {
                                    selectStates.data('init', 0);
                                }

                                // manage fields order / visibility
                                if (data.fields) {
                                    if ($.inArray('zip', data.fields) > $.inArray('city', data.fields)){
                                        $(".div_zip").before($(".div_city"));
                                    }
                                    else {
                                        $(".div_zip").after($(".div_city"));
                                    }
                                    var all_fields = ["street", "zip", "city", "country_name"]; // "state_code"];
                                    _.each(all_fields, function(field) {
                                        $(".checkout_autoformat .div_" + field.split('_')[0]).toggle($.inArray(field, data.fields)>=0);
                                    });
                                }
                            }
                        );
                    }
                }, 500);
            });
        }
        $("select[name='country_id']").change();
    });

    // Deactivate image zoom for mobile devices, since it might prevent users to scroll
    if (config.device.size_class > config.device.SIZES.XS) {
        $('.ecom-zoomable img[data-zoom]').zoomOdoo({ attach: '#o-carousel-product'});
    }
});
