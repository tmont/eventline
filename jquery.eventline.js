/**
 * This library depends on the following libraries:
 * - dateFormat
 * - jquery
 * - jquery.mousewheel
 *
 * They are all included in the lib/ directory. Go wild.
 *
 * Originally written by Tommy Montgomery.
 *
 * Licensed under the WTFPL http://www.wtfpl.net/about/
 */
(function(window, document, $) {

	function Eventline($element, options) {
		this.$element = $element;
		this.events = options.events || [];
		this.defaultCategories = options.defaultCategories || [];
		this.widthPerUnit = this.currentWidthPerUnit = options.widthPerUnit || 150;

		// clean up events
		this.events.forEach(function(event) {
			event.moment = event.moment ? 1 : 0;
			if (!(event.startDate instanceof Date)) {
				event.startDate = new Date(event.startDate);
			}
			if (event.endDate && !(event.endDate instanceof Date)) {
				event.endDate = new Date(event.endDate);
			}
		});

		this.events.sort(function(a, b) {
			var timeA = a.startDate.getTime(),
				timeB = b.startDate.getTime();

			if (timeA === timeB) {
				return 0;
			}

			return timeA < timeB ? -1 : 1;
		});
	}

	Eventline.prototype = {
		getDataRange: function(events) {
			if (!events.length) {
				return null;
			}

			var isContinuous = false;
			for (var i = 0; i < events.length; i++) {
				if (!events[i].endDate && !events[i].moment) {
					isContinuous = true;
					break;
				}
			}

			var earliestDate = events[0].startDate,
				lastEvent = events[events.length - 1],
				latestDate = isContinuous
					? new Date()
					: (lastEvent.moment ? lastEvent.startDate : lastEvent.endDate);

			return {
				start: earliestDate,
				end: latestDate,
				continuous: isContinuous
			}
		},

		getCategories: function() {
			return this.events
				.map(function(event) {
					return event.category;
				})
				.filter(function(name, i, array) {
					return array.indexOf(name) === i;
				});
		},

		getActiveEvents: function() {
			var activeCategories = this.$element
				.find('.eventline-legend li')
				.not('.eventline-inactive')
				.map(function() {
					return $(this).attr('data-category');
				})
				.toArray();

			return this.events.filter(function(event) {
				return activeCategories.indexOf(event.category) !== -1;
			});
		},

		renderEvents: function(events) {
			var $container = this.$element.find('.eventline-container');
			$container.find('.eventline-axis, .eventline-graph-events, .eventline-grid-lines').empty();
			$container.find('.eventline-graph, .eventline-graph-container').css({ width: 'auto', height: 'auto' });
			$container.find('.eventline-no-events').remove();
			$('.eventline-event-description').remove();

			var range = this.getDataRange(events);
			if (!range) {
				var arrow = String.fromCharCode(0x2191);
				$('<div/>')
					.addClass('eventline-no-events')
					.append($('<div/>')
						.addClass('eventline-message')
						.text(arrow + ' Choose a category ' + arrow)
					)
					.appendTo($container.find('.eventline-scrollable'));
				return;
			}

			var earliestDate = range.start,
				latestDate = range.end,
				continuous = range.continuous,
				rangeInMs = latestDate.getTime() - earliestDate.getTime(),
				interval = 1,
				unit = 'year';

			var times = {};
			times.hour = 1000 * 60 * 60;
			times.day = times.hour * 24;
			times.month = times.day * 30;
			times.year = times.day * 365;

			var hours = rangeInMs / times.hour,
				days = rangeInMs / times.day,
				months = rangeInMs / times.month,
				years = rangeInMs / times.year;

			if (years < 8) {
				if (months < 10) {
					if (days < 10) {
						//hour range: 0-240
						interval = Math.round(hours / 10);
						unit = 'hour';
						earliestDate = new Date(dateFormat(earliestDate, 'yyyy-mm-dd hh:00:00'));
					} else {
						//day range: 10-180
						interval = Math.round(days / 10);
						unit = 'day';
						earliestDate = new Date(dateFormat(earliestDate, 'yyyy-mm-dd'));
					}
				} else {
					//month range: 10-120
					interval = Math.round(months / 10);
					unit = 'month';
					earliestDate = new Date(dateFormat(earliestDate, 'yyyy-mm'));
				}
			} else {
				interval = Math.round(years / 10);
				unit = 'year';
				earliestDate = new Date(earliestDate.getFullYear().toString());
			}

			interval = Math.max(1, interval);

			//recalculate range
			rangeInMs = latestDate.getTime() - earliestDate.getTime();

			var pixelsPerUnit = this.currentWidthPerUnit / interval,
				current = new Date(earliestDate),
				activeWidth = rangeInMs / times[unit] * pixelsPerUnit,
				$axis = $container
					.find('.eventline-axis')
					.removeClass('eventline-year eventline-month eventline-day eventline-hour')
					.addClass('eventline-' + unit),
				$lines = $container.find('.eventline-grid-lines'),
				eventHeight = 10;

			//+100 for event abbreviation overflow
			$container.find('.eventline-graph-container').css('width', activeWidth + 100);

			//+20 for some padding around whole graph, *1.5 for padding between events
			$container.find('.eventline-graph').css('height', events.length * eventHeight * 1.5 + 20);

			var segmentLocations = [];
			function createSegment(date) {
				var left = (date.getTime() - earliestDate.getTime()) / rangeInMs * activeWidth;
				if (left - segmentLocations[segmentLocations.length - 1] < 35) {
					return null;
				}

				segmentLocations.push(left);
				$lines.append($('<li/>').css({ left: left }));
				return $('<li/>')
					.css({ left: left })
					.append($('<span/>').addClass('eventline-axis-label'))
					.appendTo($axis);
			}

			var $segment;
			do {
				$segment = createSegment(current);
				if (!$segment) {
					continue;
				}

				var text = '';
				switch (unit) {
					case 'year':
						text = current.getUTCFullYear();
						current.setUTCFullYear(current.getUTCFullYear() + interval);
						break;
					case 'month':
						text = dateFormat(current, 'UTC:mmm yyyy');
						current.setMonth(current.getUTCMonth() + interval);
						break;
					case 'day':
						text = dateFormat(current, 'UTC:mmm d');
						current.setDate(current.getUTCDate() + interval);
						break;
					case 'hour':
						text = dateFormat(current, 'UTC:mmm d htt');
						current.setHours(current.getUTCHours() + interval);
						break;
				}

				$segment.find('.eventline-axis-label').text(text);
			} while (current < latestDate);

			if (continuous) {
				//and one more segment for right now
				$segment = createSegment(latestDate);
				if ($segment) {
					$segment.find('.eventline-axis-label').text('Now');
				}
			}

			var $events = $container.find('.eventline-graph-events');
			events.forEach(function(event, i) {
				var $event = $('<div/>').addClass('eventline-event').attr('data-abbreviation', event.abbreviation);
				if (event.category) {
					$event.addClass('eventline-category-' + event.category.toLowerCase());
				}

				var endDate = event.endDate || latestDate;
				if (event.moment) {
					$event.addClass('eventline-moment');
				} else {
					var elapsed = endDate.getTime() - event.startDate.getTime();
					$event.width(elapsed / rangeInMs * activeWidth);
				}

				var leftMs = event.startDate.getTime() - earliestDate.getTime(),
					left = leftMs / rangeInMs;

				$event.css({
					left: left * activeWidth,
					top: 10 + (eventHeight + (eventHeight / 2)) * i + (+event.moment * 2)
				});

				var format = 'UTC:mmmm d, yyyy',
					timeString = dateFormat(event.startDate, format),
					emDash = String.fromCharCode(0x2014);
				if (event.endDate) {
					timeString += ' ' + emDash + ' ' + dateFormat(event.endDate, format);
				} else if (!event.moment) {
					timeString += ' ' + emDash + ' present';
				}
				var $description = $('<div/>')
					.addClass('tooltip eventline-event-description')
					.append($('<div/>').addClass('eventline-title').text(event.title))
					.append($('<time/>').text(timeString))
					.append($('<p/>').text(event.description));

				(function() {
					var timeout;
					$event
						.mouseenter(function(e) {
							if (timeout) {
								window.clearTimeout(timeout);
								timeout = null;
								return;
							}

							//remove all other floating descriptions
							$('.eventline-event-description').remove();
							$description
								.removeClass('top bottom')
								.css({ left: 0, top: 0, visibility: 'hidden' })
								.appendTo('body');

							var height = $event.outerHeight(),
								tipHeight = $description.outerHeight();
							var top = $event.offset().top + height + 5;
							if (top + tipHeight < $(window).height()) {
								$description.addClass('top');
							} else {
								$description.addClass('bottom');
								top -= height + 5 + tipHeight + 5;
							}

							$description
								.css({
									visibility: 'visible',
									left: e.clientX + $(document).scrollLeft() - 140,
									top: top
								});
						})
						.mouseleave(function() {
							timeout = window.setTimeout(function() {
								$description.remove();
								timeout = null;
							}, 250);
						});
				}());

				$events.append($event);
			});
		},

		render: function() {
			if (this.$element.hasClass('eventline-rendered')) {
				return;
			}

			var $legend = $('<ul/>').addClass('eventline-legend'),
				self = this;
			this.getCategories().forEach(function(name) {
				var cssName = name.toLowerCase().replace(/\s+/g, '-'),
					inactive = self.defaultCategories.length && self.defaultCategories.indexOf(name) === -1;

				$('<li/>')
					.attr('data-category', name)
					.attr('title', 'Toggle ' + name.toLowerCase() + ' events')
					.addClass(inactive ? 'eventline-inactive' : '')
					.append($('<span/>').addClass('eventline-category-color eventline-category-' + cssName))
					.append($('<span/>').addClass('eventline-category-label').text(name))
					.click(function() {
						$(this).toggleClass('eventline-inactive');
						self.renderEvents(self.getActiveEvents());
					})
					.appendTo($legend);
			});

			var $scrollContainer = $('<div/>')
				.addClass('eventline-scrollable')
				.mousewheel(function(e) {
					if (e.deltaX !== 0 || e.deltaY === 0) {
						//scrolling left/right manually or not scrolling at all
						return;
					}

					e.preventDefault();

					if (e.altKey) {
						self.currentWidthPerUnit = Math.max(50, self.currentWidthPerUnit + (e.deltaY * 20));
						self.renderEvents(self.getActiveEvents());
					} else {
						$(this)
							.stop(true, true)
							.animate({ scrollLeft: '-=' + (e.deltaY * 20) }, 200, 'linear');
					}
				})
				.append($legend)
				.append($('<div/>')
					.addClass('eventline-graph-container')
					.append($('<ol/>').addClass('eventline-axis'))
					.append($('<div/>')
						.addClass('eventline-graph')
						.append($('<ol/>').addClass('eventline-grid-lines'))
						.append($('<div/>').addClass('eventline-graph-events'))
					)
				);

			var $info = $('<div/>')
				.addClass('eventline-info')
				.text('?')
				.click(function() {
					var $popup = $('.eventline-info-popup');
					if ($popup.length) {
						$popup.remove();
						return;
					}

					$popup = $('<div/>')
						.addClass('eventline-info-popup tooltip top')
						.append($('<a/>')
							.attr({ href: 'https://github.com/tmont/eventline', target: '_blank' })
							.text('Eventline')
						)
						.append(' by ')
						.append($('<a/>')
							.attr({ href: 'http://tmont.com/', target: '_blank' })
							.text('Tommy Montgomery')
						)
						.appendTo('body');

					var width = $popup.outerWidth(),
						offset = $(this).offset(),
						infoWidth = $info.outerWidth(),
						infoHeight = $info.outerHeight();

					$popup.css({
						left: offset.left + infoWidth / 2 - width / 2,
						top: offset.top + infoHeight + 5
					});
				});

			$(document).on('click.eventline', function(e) {
				var $target = $(e.target),
					cls = 'eventline-info-popup',
					info = $('eventline-info')[0];
				if ($target.hasClass(cls) || $target.closest('.' + cls).length) {
					return;
				}
				if ($target[0] === $info[0]) {
					return;
				}

				$('.' + cls).remove();
			});

			$('<div/>')
				.addClass('eventline-container')
				.append($info, $legend, $scrollContainer)
				.appendTo(this.$element);

			var events = this.events.filter(function(event) {
				return !self.defaultCategories.length || self.defaultCategories.indexOf(event.category) !== -1;
			});

			this.renderEvents(events);

			this.$element.addClass('eventline-rendered');
		},

		destroy: function() {
			this.$element.empty().removeClass('eventline-rendered');
			$(document).off('.eventline');
		}
	};

	$.fn.eventline = function(options) {
		return this.each(function() {
			var $element = $(this),
				eventline = $element.data('eventline'),
				method = typeof(options) === 'string' ? options : null;

			if (!eventline) {
				eventline = new Eventline($element, typeof(options) === 'object' ? options : {});
				$element.data('eventline', eventline);
				method = 'render';
			}

			if (method) {
				eventline[method] && eventline[method]();
			}
		});
	};

}(window, document, jQuery));